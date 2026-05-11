import { afterEach, describe, expect, it } from "vitest";

import { runFullClinicalPipeline } from "@/lib/pipeline/full-clinical-pipeline";

describe("runFullClinicalPipeline", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("returns empty extraction for blank note", async () => {
    const r = await runFullClinicalPipeline("   ", {
      patientName: "Test",
      age: 40,
    });
    expect(r.clinicalNotes).toBe("");
    expect(r.extraction.length).toBe(0);
    expect(r.risk.riskScore).toBeGreaterThanOrEqual(0);
  });

  it("runs deterministic extraction and produces ordered trace with mechanisms (no API keys)", async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const r = await runFullClinicalPipeline("Lost 5kg in 1 month; poor appetite; fatigue.", {
      patientName: "Test",
      age: 70,
      ocrConfidence: 0.5,
      inputSource: "paste",
      rawDocumentText: "Lost 5kg in 1 month; poor appetite; fatigue.",
    });
    expect(r.extraction.length).toBeGreaterThan(0);
    const trace = JSON.parse(r.pipelineTraceJson) as { stage?: string; mechanism?: string }[];
    expect(trace.length).toBeGreaterThanOrEqual(5);
    expect(trace.some((t) => t.stage === "extraction" && t.mechanism === "rules")).toBe(true);
    expect(trace.some((t) => t.stage === "risk_score")).toBe(true);
    expect(r.risk.riskLevel).toMatch(/High|Medium|Low/);
    expect(r.structuredBundle.entry.length).toBeGreaterThan(3);
    expect(r.analysisConfidence).toBeGreaterThan(0);
    expect(r.scoringMethod).toBe("rules-engine");
  });
});
