import { describe, expect, it } from "vitest";

import { analyzeWithRulesRaw } from "@/lib/analysis/rules";

describe("analyzeWithRulesRaw", () => {
  it("flags GI distress for n/v shorthand", () => {
    const r = analyzeWithRulesRaw("Patient with n/v and abdominal pain.");
    expect(r.signals.some((s) => s.includes("Nausea"))).toBe(true);
  });

  it("respects fever negation", () => {
    const r = analyzeWithRulesRaw("Denies fever; fatigue and poor appetite.");
    expect(r.signals.some((s) => s.includes("Fever"))).toBe(false);
  });
});
