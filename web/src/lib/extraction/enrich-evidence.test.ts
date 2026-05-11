import { describe, expect, it } from "vitest";

import { extractClinicalSignals } from "@/lib/extraction/clinical-signals";
import { enrichSignalsForPersistence, findPhraseSpansInRaw } from "@/lib/extraction/enrich-evidence";

describe("findPhraseSpansInRaw", () => {
  it("finds case-insensitive match when exact substring missing", () => {
    const raw = "Denies FEVER but has nausea.";
    const spans = findPhraseSpansInRaw(raw, ["fever"]);
    expect(spans.length).toBeGreaterThan(0);
    expect(raw.slice(spans[0].start, spans[0].end).toLowerCase()).toContain("fever");
  });

  it("returns spans for noisy OCR token", () => {
    const raw = "Pt c/o n@usea abd pain";
    const spans = findPhraseSpansInRaw(raw, ["abd pain"]);
    expect(spans.length).toBe(1);
    expect(raw.slice(spans[0].start, spans[0].end)).toBe("abd pain");
  });
});

describe("enrichSignalsForPersistence", () => {
  it("tags OCR + LLM when configured on modality", () => {
    const extraction = extractClinicalSignals("lost 4kg; poor appetite; fatigue.");
    const enriched = enrichSignalsForPersistence(extraction, {
      rawDocumentText: "lost 4kg; poor appetite; fatigue.",
      clinicalNotes: "lost 4kg; poor appetite; fatigue.",
      inputSource: "image",
      llmScoring: true,
    });
    const wl = enriched.find((e) => e.key === "weight_loss");
    expect(wl?.evidenceSources).toContain("rules");
    expect(wl?.evidenceSources).toContain("ocr");
    expect(wl?.evidenceSources).toContain("llm");
  });

  it("remaps spans onto raw when canonical differs", () => {
    const extraction = extractClinicalSignals("poor appetite and fatigue.");
    const enriched = enrichSignalsForPersistence(extraction, {
      rawDocumentText: "  poor appetite and fatigue.  ",
      clinicalNotes: "poor appetite and fatigue.",
      inputSource: "paste",
      llmScoring: false,
    });
    const app = enriched.find((e) => e.key === "appetite");
    expect(app?.spans?.length).toBeGreaterThan(0);
  });
});
