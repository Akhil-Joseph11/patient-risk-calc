import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

import type { RiskAnalysis } from "@/lib/analysis-types";

import {
  GROQ_API_BASE_DEFAULT,
  GROQ_DEFAULT_MODEL,
  LLM_SYSTEM,
  geminiModelId,
} from "./constants";
import {
  type AnalysisResultInternal,
  analyzeWithRulesRaw,
  buildExplanation,
} from "./rules";

function normalizeRiskLevel(score: number): RiskAnalysis["riskLevel"] {
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

export function toRiskAnalysis(r: AnalysisResultInternal): RiskAnalysis {
  const score = Math.max(0, Math.min(100, r.risk_score));
  return {
    signals: r.signals,
    riskScore: score,
    riskLevel: normalizeRiskLevel(score),
    explanation: r.explanation,
  };
}

/** Deterministic keyword / regex scoring (final cascade step). */
export function analyzeWithRules(notes: string): RiskAnalysis {
  return toRiskAnalysis(analyzeWithRulesRaw(notes));
}

function stripJsonFence(raw: string): string {
  let text = raw.trim();
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    if (lines.length && lines[0].startsWith("```")) lines.shift();
    if (lines.length && lines[lines.length - 1].trim() === "```") lines.pop();
    text = lines.join("\n").trim();
  }
  return text;
}

function coerceRiskToInt(value: unknown): number {
  if (typeof value === "boolean") {
    throw new TypeError("risk_score must be numeric, not boolean");
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) throw new Error("empty risk_score");
    const n = parseFloat(s);
    if (Number.isNaN(n)) throw new Error("risk_score is not numeric");
    return Math.round(n);
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) throw new Error("risk_score is NaN");
    return Math.round(value);
  }
  throw new Error("risk_score is not numeric");
}

function analysisFromLlmJson(
  raw: string,
  notes: string,
  opts: { preserveLlmOutput?: boolean; requireExplicitRiskScore?: boolean } = {}
): AnalysisResultInternal {
  const data = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
  const signals = (Array.isArray(data.signals) ? data.signals : [])
    .map((s) => String(s).trim())
    .filter(Boolean);

  const rs = data.risk_score ?? data.riskScore;
  let risk: number;
  if (rs === undefined || rs === null) {
    if (opts.requireExplicitRiskScore) throw new Error("LLM JSON missing risk_score");
    risk = 0;
  } else {
    risk = coerceRiskToInt(rs);
  }
  risk = Math.max(0, Math.min(100, risk));

  let explanation = String(data.explanation ?? "").trim();
  if (!explanation) {
    explanation = buildExplanation(signals, risk, notes);
  }

  if (!signals.length) {
    if (opts.preserveLlmOutput) {
      return {
        signals: ["Clinical themes summarized in explanation"],
        risk_score: risk,
        explanation,
      };
    }
    return analyzeWithRulesRaw(notes);
  }

  return { signals, risk_score: risk, explanation };
}

async function analyzeWithGroq(notes: string): Promise<AnalysisResultInternal> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return analyzeWithRulesRaw(notes);

  const client = new OpenAI({
    apiKey,
    baseURL: process.env.GROQ_API_BASE?.trim() || GROQ_API_BASE_DEFAULT,
  });
  const model = process.env.GROQ_MODEL?.trim() || GROQ_DEFAULT_MODEL;
  const user = `Clinical note:\n${notes}`;

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: LLM_SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const raw = resp.choices[0]?.message?.content ?? "{}";
  try {
    return analysisFromLlmJson(raw, notes, {
      preserveLlmOutput: true,
      requireExplicitRiskScore: true,
    });
  } catch (exc) {
    console.warn("Groq response missing or invalid risk_score; using rules.", exc);
    return analyzeWithRulesRaw(notes);
  }
}

async function analyzeWithGemini(notes: string): Promise<AnalysisResultInternal> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (!apiKey) return analyzeWithRulesRaw(notes);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: geminiModelId(),
    systemInstruction: LLM_SYSTEM,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(`Clinical note:\n${notes}`);
  const raw = result.response.text()?.trim() || "{}";
  return analysisFromLlmJson(raw, notes, { preserveLlmOutput: true });
}

async function analyzeWithOpenAI(notes: string): Promise<AnalysisResultInternal> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return analyzeWithRulesRaw(notes);

  const client = new OpenAI({ apiKey });
  const user = `Clinical note:\n${notes}`;
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    messages: [
      { role: "system", content: LLM_SYSTEM },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });
  const raw = resp.choices[0]?.message?.content ?? "{}";
  return analysisFromLlmJson(raw, notes, { preserveLlmOutput: true });
}

/** Groq → Gemini → OpenAI → deterministic rules. */
export async function analyzeNotes(notes: string): Promise<RiskAnalysis> {
  const text = notes.trim();

  if (process.env.GROQ_API_KEY?.trim()) {
    try {
      return toRiskAnalysis(await analyzeWithGroq(text));
    } catch (exc) {
      console.warn("Groq failed; trying next analyzer.", exc);
    }
  }

  if ((process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim()) {
    try {
      return toRiskAnalysis(await analyzeWithGemini(text));
    } catch (exc) {
      console.warn("Gemini failed; trying next analyzer.", exc);
    }
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      return toRiskAnalysis(await analyzeWithOpenAI(text));
    } catch (exc) {
      console.warn("OpenAI failed; using rules fallback.", exc);
    }
  }

  return toRiskAnalysis(analyzeWithRulesRaw(text));
}

export function groqAnalysisConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function geminiAnalysisConfigured(): boolean {
  return Boolean((process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim());
}
