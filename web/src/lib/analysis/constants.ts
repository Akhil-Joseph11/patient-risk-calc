export const GEMINI_SCORING_MODEL_DEFAULT = "gemini-flash-latest";

export function geminiModelId(): string {
  return process.env.GEMINI_MODEL?.trim() || GEMINI_SCORING_MODEL_DEFAULT;
}

export const GROQ_API_BASE_DEFAULT = "https://api.groq.com/openai/v1";

export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

const LLM_JSON_TASK =
  "You are a clinical documentation assistant for case prioritization (not for diagnosis). " +
  "From the note, extract short signal labels (e.g. weight loss, poor appetite). " +
  "Return strict JSON only with keys: signals (array of strings), risk_score (integer 0-100), " +
  "explanation (string). " +
  "signals MUST be a non-empty array with at least one concise label (never [] or null). " +
  "The explanation string should be roughly 180–380 words: several paragraphs are fine (use \\n\\n between paragraphs). " +
  "Write in neutral clinician handoff voice—what is documented, what is unclear, trajectory, and sensible follow-up urgency implied by the text only. " +
  "Do not mention software, JSON, APIs, models, algorithms, blending weights, pipelines, or how the score is computed. " +
  "Do not invent facts beyond the note; if information is missing, say so explicitly. " +
  "The prose should naturally align with the integer risk_score you chose (more documented acute or overlapping problems justify higher scores; negations and reassuring language justify lower scores).";

const RISK_SCORING_PROTOCOL =
  "risk_score is ONE integer 0-100 representing documented clinical concern and how soon review would " +
  "typically be warranted in this triage-style workflow (not a formal diagnosis, prognosis, or calibrated " +
  "clinical prediction). Anchor ONLY on facts explicitly written—do not invent problems or severity. " +
  "Precision: choose a specific integer (e.g. 43, 57, 71), not a generic round placeholder; avoid " +
  "multiples of 5 or 10 unless the wording clearly sits at a band boundary. Small differences of a few " +
  "points should reflect real differences in severity, number of independent active problems, acuity, " +
  "functional impact, or certainty (hedged 'possible' vs firm clinical descriptors). " +
  "Reason internally (do not output steps): list concerning findings and protective/negated items; " +
  "give more weight to acute or high-impact issues (e.g. altered mental status, respiratory compromise, " +
  "systemic infection concern, rapid decline, marked unintended weight loss with symptoms); dampen " +
  "scores when negations apply ('denies fever', 'no SOB'); cap upward movement when the note is vague. " +
  "Map the synthesis onto bands, then fine-tune inside the band: " +
  "0-34 mostly reassuring, stable, routine, or non-specific without concrete concerning detail; " +
  "35-54 one clear mild issue or a few low-impact symptoms without red flags; " +
  "55-69 multiple moderate concerns, meaningful nutritional/functional decline, worsening trajectory, " +
  "or ambiguity needing timely follow-up; " +
  "70-89 serious acute or progressive problems or overlapping major risks documented in the text; " +
  "90-100 several severe acute threats together. " +
  "Malnutrition risk, infection flags, and functional decline matter when documented; negated findings " +
  "must reduce the relevant concern.";

export const LLM_SYSTEM = `${LLM_JSON_TASK} ${RISK_SCORING_PROTOCOL}`;
