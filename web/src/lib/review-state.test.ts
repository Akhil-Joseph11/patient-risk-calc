import { describe, expect, it } from "vitest";

import {
  deriveCaseReviewState,
  hasConflictingSignalKeys,
  noteHasAmbiguousLanguage,
} from "@/lib/review-state";

describe("noteHasAmbiguousLanguage", () => {
  it("detects vague chart language", () => {
    expect(noteHasAmbiguousLanguage("Limited info; unclear if symptoms worsened.")).toBe(true);
  });

  it("returns false for concrete SOAP-style note", () => {
    expect(
      noteHasAmbiguousLanguage("Lost 5kg in 2 months; poor appetite; denies fever.")
    ).toBe(false);
  });
});

describe("hasConflictingSignalKeys", () => {
  it("flags protective plus decline", () => {
    const k = new Set(["stable_protective", "weight_loss"]);
    expect(hasConflictingSignalKeys(k)).toBe(true);
  });

  it("does not flag protective alone", () => {
    expect(hasConflictingSignalKeys(new Set(["stable_protective"]))).toBe(false);
  });
});

describe("deriveCaseReviewState", () => {
  it("downgrades ambiguous conflicting OCR notes toward review", () => {
    const state = deriveCaseReviewState({
      analysisConfidence: 78,
      ocrConfidence: 0.4,
      inputSource: "image",
      extractionKeys: ["stable_protective", "weight_loss"],
      clinicalNote: "Unclear timeline; possibly worse per family.",
    });
    expect(state).toBe("needs_human_review");
  });

  it("allows high confidence for clean typed notes with strong extraction", () => {
    const state = deriveCaseReviewState({
      analysisConfidence: 82,
      ocrConfidence: null,
      inputSource: "paste",
      extractionKeys: ["fatigue", "appetite"],
      clinicalNote: "Poor appetite x1wk and fatigue. denies fever.",
    });
    expect(state).toBe("high_confidence");
  });
});
