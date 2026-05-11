import { NextResponse } from "next/server";

import { GROQ_DEFAULT_MODEL, geminiModelId } from "@/lib/analysis/constants";
import { geminiAnalysisConfigured, groqAnalysisConfigured } from "@/lib/analysis/analyze-notes";

export const dynamic = "force-dynamic";

/** Active scoring path for new cases (no secrets). */
export async function GET() {
  const groq = groqAnalysisConfigured();
  const gemini = geminiAnalysisConfigured();
  const openai = Boolean(process.env.OPENAI_API_KEY?.trim());

  const groqModel = process.env.GROQ_MODEL?.trim() || GROQ_DEFAULT_MODEL;

  let primary: string;
  if (groq) {
    primary = `groq:${groqModel}`;
  } else if (gemini) {
    primary = geminiModelId();
  } else if (openai) {
    primary = "openai";
  } else {
    primary = "deterministic-rules";
  }

  return NextResponse.json({
    groq_api_key_present: groq,
    groq_model: groq ? groqModel : null,
    gemini_api_key_present: gemini,
    gemini_model: gemini ? geminiModelId() : null,
    openai_configured: openai,
    primary_analyzer: primary,
  });
}
