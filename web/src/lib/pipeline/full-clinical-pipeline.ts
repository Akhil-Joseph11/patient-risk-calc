import { extractClinicalSignals, type ClinicalSignalEvidence } from "@/lib/extraction/clinical-signals";
import { buildClinicalBundle } from "@/lib/healthcare/build-clinical-bundle";
import type { DemoClinicalBundle } from "@/lib/healthcare/fhir-inspired-types";
import { analyzeNotes, analyzeWithRules } from "@/lib/analysis/analyze-notes";
import type { RiskAnalysis } from "@/lib/analysis-types";

import { buildClinicalPipelineTrace } from "@/lib/pipeline/clinical-trace";

export type { ClinicalPipelineTraceEntry, TraceMechanism } from "@/lib/pipeline/clinical-trace";

export type FullClinicalPipelineResult = {
  clinicalNotes: string;
  extraction: ClinicalSignalEvidence[];
  risk: RiskAnalysis;
  structuredBundle: DemoClinicalBundle;
  signalEvidenceJson: string;
  structuredRecordJson: string;
  pipelineTraceJson: string;
  analysisConfidence: number;
  scoringMethod: "rules-engine" | "rules-plus-llm";
};

export async function runFullClinicalPipeline(
  clinicalNotes: string,
  opts: {
    ocrConfidence?: number | null;
    patientName?: string;
    age?: number;
    inputSource?: string;
    rawDocumentText?: string;
  } = {}
): Promise<FullClinicalPipelineResult> {
  const patientName = opts.patientName?.trim() || "Unknown patient";
  const age = Number.isFinite(opts.age) ? Math.round(opts.age as number) : 0;
  const inputSource = opts.inputSource ?? "paste";
  const text = clinicalNotes.trim();
  const raw = (opts.rawDocumentText ?? clinicalNotes).trim();
  const rawEqualsClinical = raw === text;

  if (!text) {
    const emptyRisk = analyzeWithRules("");
    const bundle = buildClinicalBundle({
      patientName,
      age,
      clinicalNoteText: "",
      inputSource,
      signals: [],
      riskScore: emptyRisk.riskScore,
      riskLevel: emptyRisk.riskLevel,
      explanation: emptyRisk.explanation,
      scoringMethod: "rules-engine",
    });
    const pipelineTraceJson = JSON.stringify([
      {
        order: 1,
        stage: "raw_input",
        title: "Raw clinical input",
        detail: "Empty note — cannot extract signals.",
        mechanism: "n_a",
        status: "error",
      },
    ]);
    return {
      clinicalNotes: "",
      extraction: [],
      risk: emptyRisk,
      structuredBundle: bundle,
      signalEvidenceJson: "[]",
      structuredRecordJson: JSON.stringify(bundle),
      pipelineTraceJson,
      analysisConfidence: 0,
      scoringMethod: "rules-engine",
    };
  }

  const extraction = extractClinicalSignals(text);
  const rulesOnly = analyzeWithRules(text);
  let risk: RiskAnalysis = rulesOnly;
  let scoringMethod: FullClinicalPipelineResult["scoringMethod"] = "rules-engine";

  const hasLlm =
    Boolean(process.env.GROQ_API_KEY?.trim()) ||
    Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim()) ||
    Boolean(process.env.OPENAI_API_KEY?.trim());

  if (hasLlm) {
    try {
      const llm = await analyzeNotes(text);
      const blended = Math.round(rulesOnly.riskScore * 0.55 + llm.riskScore * 0.45);
      const clamped = Math.max(0, Math.min(100, blended));
      const level: RiskAnalysis["riskLevel"] =
        clamped >= 70 ? "High" : clamped >= 45 ? "Medium" : "Low";
      risk = {
        signals: llm.signals.length ? llm.signals : rulesOnly.signals,
        riskScore: clamped,
        riskLevel: level,
        explanation: (llm.explanation || "").trim() || rulesOnly.explanation,
      };
      scoringMethod = "rules-plus-llm";
    } catch {
      risk = rulesOnly;
    }
  }

  const bundle = buildClinicalBundle({
    patientName,
    age,
    clinicalNoteText: text,
    inputSource,
    signals: extraction,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    explanation: risk.explanation,
    scoringMethod,
  });

  const avgSigConf = extraction.length
    ? extraction.reduce((a, s) => a + s.confidence, 0) / extraction.length
    : 0.35;
  const ocr = opts.ocrConfidence;
  const ocrFactor = ocr == null || Number.isNaN(ocr) ? 1 : Math.max(0.35, Math.min(1, ocr));
  const analysisConfidence = Math.round(100 * avgSigConf * (0.55 + 0.45 * ocrFactor));

  const pipelineTraceJson = JSON.stringify(
    buildClinicalPipelineTrace({
      rawDocumentLength: raw.length,
      clinicalLength: text.length,
      rawEqualsClinical,
      inputSource,
      ocrConfidence: ocr ?? null,
      extractionCount: extraction.length,
      bundleEntryCount: bundle.entry.length,
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
      scoringMethod,
    })
  );

  return {
    clinicalNotes: text,
    extraction,
    risk,
    structuredBundle: bundle,
    signalEvidenceJson: JSON.stringify(extraction),
    structuredRecordJson: JSON.stringify(bundle),
    pipelineTraceJson,
    analysisConfidence,
    scoringMethod,
  };
}

/** Updates Patient name and age on a bundle after assembly. */
export function patchBundlePatientDemographics(
  bundle: DemoClinicalBundle,
  patientName: string,
  age: number
): DemoClinicalBundle {
  const clone = JSON.parse(JSON.stringify(bundle)) as DemoClinicalBundle;
  for (const e of clone.entry) {
    if (e.resource.resourceType === "Patient") {
      e.resource.nameText = patientName;
      e.resource.ageYears = age;
    }
  }
  return clone;
}
