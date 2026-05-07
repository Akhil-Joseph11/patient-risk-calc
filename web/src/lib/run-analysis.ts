import { analyzeNotes, analyzeWithRules } from "@/lib/analysis/analyze-notes";
import type { RiskAnalysis } from "@/lib/analysis-types";

export async function runRiskAnalysis(clinicalNotes: string): Promise<RiskAnalysis> {
  try {
    return await analyzeNotes(clinicalNotes);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Patient RiskCalc] analyzeNotes failed — using keyword fallback.", err);
    }
    return analyzeWithRules(clinicalNotes);
  }
}
