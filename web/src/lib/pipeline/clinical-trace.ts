/** Ordered pipeline steps for case detail (stage, mechanism, outcome). */

export type TraceMechanism = "rules" | "ocr" | "llm" | "hybrid" | "n_a";

export type ClinicalPipelineTraceEntry = {
  order?: number;
  stage?: "raw_input" | "ocr" | "extraction" | "structured_bundle" | "risk_score" | "explanation" | string;
  title: string;
  detail: string;
  mechanism?: TraceMechanism;
  status: "ok" | "warn" | "error";
  id?: string;
};

export function buildClinicalPipelineTrace(opts: {
  rawDocumentLength: number;
  clinicalLength: number;
  rawEqualsClinical: boolean;
  inputSource: string;
  ocrConfidence: number | null | undefined;
  extractionCount: number;
  bundleEntryCount: number;
  riskLevel: string;
  riskScore: number;
  scoringMethod: "rules-engine" | "rules-plus-llm";
}): ClinicalPipelineTraceEntry[] {
  const out: ClinicalPipelineTraceEntry[] = [];
  let order = 1;

  out.push({
    order: order++,
    stage: "raw_input",
    title: "Raw clinical input",
    detail: opts.rawEqualsClinical
      ? `${opts.rawDocumentLength} characters (same text used for extraction).`
      : `Raw document ${opts.rawDocumentLength} chars → canonical note ${opts.clinicalLength} chars after any cleanup.`,
    mechanism: "n_a",
    status: opts.rawDocumentLength ? "ok" : "warn",
  });

  const isOcrPath = opts.inputSource === "image" || opts.inputSource === "pdf";
  if (isOcrPath) {
    const oc = opts.ocrConfidence;
    const pct = oc != null && Number.isFinite(oc) ? `${Math.round(Number(oc) * 100)}%` : "n/a";
    out.push({
      order: order++,
      stage: "ocr",
      title: "Document text extraction (OCR / PDF text layer)",
      detail: `Input modality: ${opts.inputSource}. Heuristic OCR/text confidence ~${pct}. Phrases below were located in the raw string for highlighting.`,
      mechanism: "ocr",
      status: oc != null && Number(oc) < 0.45 ? "warn" : "ok",
    });
  }

  out.push({
    order: order++,
    stage: "extraction",
    title: "Deterministic signal extraction",
    detail: `Regex / keyword rules produced ${opts.extractionCount} signal group(s) with evidence phrases.`,
    mechanism: "rules",
    status: opts.extractionCount ? "ok" : "warn",
  });

  out.push({
    order: order++,
    stage: "structured_bundle",
    title: "FHIR-inspired structured bundle",
    detail: `Mapped signals into ${opts.bundleEntryCount} resource entries (Patient, Encounter, Condition, etc.).`,
    mechanism: "rules",
    status: "ok",
  });

  const riskMech: TraceMechanism = opts.scoringMethod === "rules-plus-llm" ? "hybrid" : "rules";
  out.push({
    order: order++,
    stage: "risk_score",
    title: "Risk score & level",
    detail: `${opts.riskLevel} band (${opts.riskScore}/100). ${
      opts.scoringMethod === "rules-plus-llm"
        ? "Blended rule-based score with optional narrative enrichment."
        : "Rules-only scoring (enrichment path not used or unavailable)."
    }`,
    mechanism: riskMech,
    status: "ok",
  });

  out.push({
    order: order++,
    stage: "explanation",
    title: "Narrative explanation",
    detail:
      opts.scoringMethod === "rules-plus-llm"
        ? "Narrative may reflect enrichment output; phrase-level evidence stays rule-derived from the note."
        : "Narrative assembled from matched rule themes and note context.",
    mechanism: riskMech,
    status: "ok",
  });

  return out;
}
