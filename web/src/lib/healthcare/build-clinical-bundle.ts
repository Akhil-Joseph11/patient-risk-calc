import type { ClinicalSignalEvidence } from "@/lib/extraction/clinical-signals";
import type {
  DemoBundleEntry,
  DemoClinicalBundle,
  DemoClinicalNote,
  DemoCondition,
  DemoEncounter,
  DemoMedicationStatement,
  DemoObservation,
  DemoPatient,
  DemoRiskAssessment,
} from "./fhir-inspired-types";

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Maps extracted signals into Observations, Conditions, and related resources. */
export function buildClinicalBundle(opts: {
  patientName: string;
  age: number;
  clinicalNoteText: string;
  inputSource: string;
  signals: ClinicalSignalEvidence[];
  riskScore: number;
  riskLevel: string;
  explanation: string;
  scoringMethod: DemoRiskAssessment["method"];
}): DemoClinicalBundle {
  const patient: DemoPatient = {
    resourceType: "Patient",
    id: uid("pat"),
    nameText: opts.patientName,
    ageYears: opts.age,
  };

  const encounter: DemoEncounter = {
    resourceType: "Encounter",
    id: uid("enc"),
    status: "finished",
    classDisplay: "ambulatory",
    periodText: "Documented from note ingestion",
  };

  const note: DemoClinicalNote = {
    resourceType: "ClinicalNote",
    id: uid("note"),
    type: opts.inputSource === "paste" ? "progress-note" : "ocr-extract",
    text: {
      status: "generated",
      div: opts.clinicalNoteText.slice(0, 8000),
    },
  };

  const entries: DemoBundleEntry[] = [
    { resource: patient },
    { resource: encounter },
    { resource: note },
  ];

  for (const s of opts.signals) {
    if (s.key === "medications") {
      for (const med of s.evidencePhrases.slice(0, 6)) {
        const ms: DemoMedicationStatement = {
          resourceType: "MedicationStatement",
          id: uid("med"),
          medicationText: med,
          status: "active",
          evidence: s.evidencePhrases.filter((e) => e.toLowerCase().includes(med.toLowerCase())).slice(0, 3),
        };
        entries.push({ resource: ms });
      }
      continue;
    }

    if (s.key === "labs_documented") {
      for (const phrase of s.evidencePhrases.slice(0, 8)) {
        const obs: DemoObservation = {
          resourceType: "Observation",
          id: uid("obs"),
          category: "laboratory",
          codeText: "Lab value mentioned in narrative",
          valueString: phrase,
          evidence: [phrase],
        };
        entries.push({ resource: obs });
      }
      continue;
    }

    const isConditionLike =
      s.key === "weight_loss" ||
      s.key === "appetite" ||
      s.key === "fatigue" ||
      s.key === "gi_distress" ||
      s.key === "fever_infection" ||
      s.key === "respiratory" ||
      s.key === "ams" ||
      s.key === "symptom_pain";

    if (isConditionLike) {
      const cond: DemoCondition = {
        resourceType: "Condition",
        id: uid("cond"),
        clinicalStatus: "active",
        verificationStatus: "unconfirmed",
        codeText: s.label,
        evidence: s.evidencePhrases,
      };
      entries.push({ resource: cond });
    } else if (s.key === "stable_protective") {
      const obs: DemoObservation = {
        resourceType: "Observation",
        id: uid("obs"),
        category: "survey",
        codeText: s.label,
        interpretationText: "Protective / reassuring context in note",
        evidence: s.evidencePhrases,
      };
      entries.push({ resource: obs });
    }
  }

  const ra: DemoRiskAssessment = {
    resourceType: "RiskAssessment",
    id: uid("risk"),
    method: opts.scoringMethod,
    prediction: {
      outcomeText: `${opts.riskLevel} malnutrition / decompensation triage concern`,
      probabilityDecimal: Math.min(1, Math.max(0, opts.riskScore / 100)),
    },
    basis: [
      `Pattern-based clinical signals (${opts.signals.length} group${opts.signals.length === 1 ? "" : "s"}).`,
      opts.explanation.slice(0, 400),
    ],
    note: { reference: `ClinicalNote/${note.id}`, display: "Source note" },
  };
  entries.push({ resource: ra });

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: entries,
  };
}
