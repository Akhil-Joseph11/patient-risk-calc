/** Heuristic review band from wording and extraction confidence (not clinical validation). */

export type ReviewStateLabel = "high_confidence" | "medium_confidence" | "needs_human_review";

const AMBIGUOUS_RE =
  /\b(unclear|vague|maybe|possibly|unsure|limited\s+info|not\s+sure|uncertain|qualitative\s+only|per\s+family\s+only|unable\s+to\s+assess)\b/i;

/** True when narrative suggests incomplete or hedged documentation. */
export function noteHasAmbiguousLanguage(note: string): boolean {
  return AMBIGUOUS_RE.test(note);
}

/** Protective + acute-decline cues both present → reviewer should reconcile. */
export function hasConflictingSignalKeys(keys: Set<string>): boolean {
  if (!keys.has("stable_protective")) return false;
  return (
    keys.has("weight_loss") ||
    keys.has("ams") ||
    keys.has("fever_infection") ||
    keys.has("gi_distress") ||
    keys.has("respiratory")
  );
}

export type DeriveReviewStateInput = {
  analysisConfidence: number;
  ocrConfidence: number | null | undefined;
  inputSource: string;
  extractionKeys: string[];
  clinicalNote: string;
};

/**
 * Combines model confidence, OCR quality, conflicts, and vague language into a triage-style review band.
 */
export function deriveCaseReviewState(params: DeriveReviewStateInput): ReviewStateLabel {
  const keys = new Set(params.extractionKeys);
  let adjusted = params.analysisConfidence;

  const ocr = params.ocrConfidence;
  if (params.inputSource !== "paste" && ocr != null && Number.isFinite(ocr) && ocr < 0.52) {
    adjusted -= 14;
  }
  if (hasConflictingSignalKeys(keys)) adjusted -= 12;
  if (noteHasAmbiguousLanguage(params.clinicalNote)) adjusted -= 10;
  if (keys.size === 0 && params.clinicalNote.trim().length > 100) adjusted -= 8;

  adjusted = Math.max(0, Math.min(100, adjusted));

  if (adjusted >= 74 && !hasConflictingSignalKeys(keys) && !noteHasAmbiguousLanguage(params.clinicalNote)) {
    return "high_confidence";
  }
  if (adjusted >= 52) return "medium_confidence";
  return "needs_human_review";
}

export function reviewStateDisplayLabel(state: string | null | undefined): string {
  if (state === "high_confidence") return "High confidence";
  if (state === "medium_confidence") return "Medium confidence";
  if (state === "needs_human_review") return "Needs human review";
  return "Medium confidence";
}

/** For rows created before reviewState existed. */
export function inferReviewStateFromConfidenceOnly(analysisConfidence: number | null | undefined): ReviewStateLabel {
  const n = analysisConfidence ?? 60;
  if (n >= 78) return "high_confidence";
  if (n >= 52) return "medium_confidence";
  return "needs_human_review";
}
