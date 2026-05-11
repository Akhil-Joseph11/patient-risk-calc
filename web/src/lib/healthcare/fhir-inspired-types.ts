/** FHIR-inspired shapes for internal bundles (not a certified FHIR server). */

export type ResourceType =
  | "Patient"
  | "Encounter"
  | "Observation"
  | "Condition"
  | "MedicationStatement"
  | "ClinicalNote"
  | "RiskAssessment";

export type NarrativeStatus = "generated" | "additional";

export type Reference = { reference: string; display?: string };

export type DemoPatient = {
  resourceType: "Patient";
  id: string;
  nameText: string;
  birthDateApprox?: string;
  ageYears?: number;
};

export type DemoEncounter = {
  resourceType: "Encounter";
  id: string;
  status: "finished" | "in-progress" | "unknown";
  classDisplay: string;
  periodText?: string;
};

export type ObservationCategory = "vital-signs" | "laboratory" | "survey" | "exam" | "therapy";

export type DemoObservation = {
  resourceType: "Observation";
  id: string;
  category: ObservationCategory;
  codeText: string;
  valueString?: string;
  interpretationText?: string;
  /** Phrases from the source note supporting this observation (evidence). */
  evidence: string[];
};

export type DemoCondition = {
  resourceType: "Condition";
  id: string;
  clinicalStatus: "active" | "recurrence" | "inactive" | "unknown";
  verificationStatus: "unconfirmed" | "provisional" | "confirmed";
  codeText: string;
  evidence: string[];
};

export type DemoMedicationStatement = {
  resourceType: "MedicationStatement";
  id: string;
  medicationText: string;
  status: "active" | "completed" | "unknown";
  evidence: string[];
};

export type DemoClinicalNote = {
  resourceType: "ClinicalNote";
  id: string;
  type: "progress-note" | "handoff" | "ocr-extract" | "unknown";
  text: { status: NarrativeStatus; div: string };
};

export type DemoRiskAssessment = {
  resourceType: "RiskAssessment";
  id: string;
  method: "rules-engine" | "rules-plus-llm" | "fallback";
  prediction: { outcomeText: string; probabilityDecimal?: number };
  basis: string[];
  note?: Reference;
};

export type DemoBundleEntry =
  | { resource: DemoPatient }
  | { resource: DemoEncounter }
  | { resource: DemoObservation }
  | { resource: DemoCondition }
  | { resource: DemoMedicationStatement }
  | { resource: DemoClinicalNote }
  | { resource: DemoRiskAssessment };

/** Bundle container (FHIR-style type = collection). */
export type DemoClinicalBundle = {
  resourceType: "Bundle";
  type: "collection";
  timestamp: string;
  entry: DemoBundleEntry[];
};
