import { describe, expect, it } from "vitest";

import {
  extractClinicalSignals,
  negatesBefore,
} from "@/lib/extraction/clinical-signals";

describe("negatesBefore", () => {
  it("detects negated fever", () => {
    const t = "patient denies fever but looks tired";
    expect(negatesBefore(t, "fever")).toBe(true);
  });

  it("does not negate standalone fever", () => {
    const t = "febrile to 39 and fatigue";
    expect(negatesBefore(t, "fever")).toBe(false);
  });
});

describe("extractClinicalSignals", () => {
  it("extracts weight loss with evidence phrase", () => {
    const note = "Over 2 months she lost 8kg and reports poor appetite.";
    const s = extractClinicalSignals(note);
    const keys = new Set(s.map((x) => x.key));
    expect(keys.has("weight_loss")).toBe(true);
    expect(keys.has("appetite")).toBe(true);
    const wl = s.find((x) => x.key === "weight_loss");
    expect(wl?.evidencePhrases.some((p) => /8kg/i.test(p))).toBe(true);
  });

  it("skips fever when explicitly denied", () => {
    const note = "Patient denies fever but has nausea and poor appetite.";
    const s = extractClinicalSignals(note);
    const fever = s.find((x) => x.key === "fever_infection");
    expect(fever).toBeUndefined();
  });

  it("captures medication mentions", () => {
    const note = "Continue metformin; also started lisinopril for BP.";
    const s = extractClinicalSignals(note);
    const meds = s.find((x) => x.key === "medications");
    expect(meds).toBeDefined();
    expect(meds?.evidencePhrases.join(" ").toLowerCase()).toContain("metformin");
  });

  it("handles messy spacing and shorthand", () => {
    const note = "SOB stairs + n/v x3d. PO intake down.";
    const s = extractClinicalSignals(note);
    const keys = s.map((x) => x.key);
    expect(keys).toContain("respiratory");
    expect(keys).toContain("gi_distress");
    expect(keys).toContain("appetite");
  });

  it("extracts sparingly from ambiguous vague notes", () => {
    const note =
      "Ambulatory f/u — vague subjective 'feeling off' x2d. Limited info; unclear appetite. No wt recorded.";
    const s = extractClinicalSignals(note);
    expect(s.length).toBeLessThanOrEqual(3);
  });
});
