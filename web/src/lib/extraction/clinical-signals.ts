/**
 * Deterministic clinical signal extraction from unstructured text.
 * Returns evidence phrases where possible (substring matches from the original note).
 */

export type ClinicalSignalEvidence = {
  /** Stable machine key, e.g. "weight_loss". */
  key: string;
  /** Human label aligned with risk rules / UI. */
  label: string;
  confidence: number; // 0–1 heuristic from match quality
  /** Verbatim or lightly trimmed spans from the source note. */
  evidencePhrases: string[];
  /** Optional character offsets in the original string (UTF-16 indices). */
  spans?: { start: number; end: number }[];
};

type ExtractRule = {
  key: string;
  label: string;
  patterns: RegExp[];
  /** Boost when multiple distinct patterns hit (0–1 cap handled later). */
  baseConfidence: number;
};

const EXTRACT_RULES: ExtractRule[] = [
  {
    key: "weight_loss",
    label: "Significant unintentional weight loss",
    baseConfidence: 0.82,
    patterns: [
      /\b(lost|loss of|losing)\s+\d+\s*kg\b/gi,
      /\b\d+\s*kg\s+(lost|loss)\b/gi,
      /\b(weight|wt\.?)\s+(loss|down|decreased)\b/gi,
      /\bunintentional\s+weight\b/gi,
      /\bcachexia\b/gi,
      /\bwasting\b/gi,
      /\bdown\s+\d+\s*lbs?\b/gi,
    ],
  },
  {
    key: "appetite",
    label: "Poor or reduced appetite",
    baseConfidence: 0.78,
    patterns: [
      /\bpoor\s+appetite\b/gi,
      /\b(decreased|reduced|loss of)\s+appetite\b/gi,
      /\blow\s+intake\b/gi,
      /\banorexia\b/gi,
      /\bnot\s+eating\b/gi,
      /\bPO\s+intake\s+(poor|low|down)\b/gi,
    ],
  },
  {
    key: "fatigue",
    label: "Fatigue or weakness",
    baseConfidence: 0.74,
    patterns: [/\bfatigue\b/gi, /\b(tired|exhausted|lethargic|weakness|malaise)\b/gi, /\blow\s+energy\b/gi],
  },
  {
    key: "gi_distress",
    label: "Nausea, vomiting, or GI distress",
    baseConfidence: 0.72,
    patterns: [/\b(nausea|vomiting|emesis)\b/gi, /\bn\/v\b/gi, /\b(dyspepsia|abdominal\s+pain)\b/gi],
  },
  {
    key: "fever_infection",
    label: "Fever or infection concern",
    baseConfidence: 0.76,
    patterns: [/\bfever\b/gi, /\bfebrile\b/gi, /\binfection\b/gi, /\bsepsis\b/gi, /\bTmax\b/gi],
  },
  {
    key: "respiratory",
    label: "Dyspnea or respiratory symptoms",
    baseConfidence: 0.75,
    patterns: [/\b(shortness of breath|sob|dyspnea)\b/gi, /\bhypoxia\b/gi, /\b(on\s+)?oxygen\b/gi],
  },
  {
    key: "ams",
    label: "Confusion or altered mental status",
    baseConfidence: 0.8,
    patterns: [/\b(confusion|altered mental status|ams|delirium)\b/gi, /\bdisoriented\b/gi],
  },
  {
    key: "stable_protective",
    label: "Stable nutrition and recovery (protective)",
    baseConfidence: 0.7,
    patterns: [/\bstable\s+weight\b/gi, /\bnormal\s+intake\b/gi, /\brecovering\s+well\b/gi, /\bdoing\s+well\b/gi],
  },
];

/** Rough negation check aligned with rules.ts — avoids fever flag on "denies fever". */
export function negatesBefore(textLower: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `\\b(denies|deny|denied|no|without|negative for|absence of)\\s+(\\w+\\s+){0,4}${escaped}\\b`,
    "i"
  );
  return re.test(textLower);
}

function collectMatches(original: string, patterns: RegExp[]): { phrase: string; start: number; end: number }[] {
  const found: { phrase: string; start: number; end: number }[] = [];
  const seen = new Set<string>();
  for (const pat of patterns) {
    const flags = pat.flags.includes("g") ? pat.flags : pat.flags + "g";
    const re = new RegExp(pat.source, flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(original)) !== null) {
      const phrase = m[0].trim();
      if (!phrase) continue;
      const start = m.index;
      const end = start + m[0].length;
      const dedupe = `${start}:${end}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      found.push({ phrase, start, end });
    }
  }
  return found;
}

const LAB_RE =
  /\b(HbA1c|A1c|hemoglobin|hgb|glucose|bg|creatinine|cr\.?|WBC|wbc|platelets?|plt|INR|Na|K\+?|potassium|BUN)\b\s*[:\-]?\s*([\d.]+)\s*(mg\/dL|mmol\/L|%|g\/dL|K\/uL|\/uL)?/gi;

const MED_RE =
  /\b(metformin|insulin|lisinopril|losartan|omeprazole|pantoprazole|apixaban|warfarin|furosemide|torsemide|carvedilol|metoprolol|atorvastatin|rosuvastatin|prednisone|gabapentin|tramadol|oxycodone|hydrocodone|acetaminophen|ibuprofen|aspirin|levothyroxine|albuterol|tiotropium)\b/gi;

export function extractLabMentions(original: string): ClinicalSignalEvidence[] {
  const matches = collectMatches(original, [LAB_RE]);
  if (!matches.length) return [];
  const phrases = matches.map((m) => m.phrase);
  const spans = matches.map((m) => ({ start: m.start, end: m.end }));
  const conf = Math.min(0.9, 0.55 + matches.length * 0.08);
  return [
    {
      key: "labs_documented",
      label: "Abnormal or notable labs mentioned in note",
      confidence: conf,
      evidencePhrases: phrases.slice(0, 8),
      spans,
    },
  ];
}

export function extractMedications(original: string): ClinicalSignalEvidence[] {
  const matches = collectMatches(original, [MED_RE]);
  if (!matches.length) return [];
  return [
    {
      key: "medications",
      label: "Medications referenced in note",
      confidence: 0.68,
      evidencePhrases: Array.from(new Set(matches.map((m) => m.phrase))).slice(0, 12),
      spans: matches.map((m) => ({ start: m.start, end: m.end })),
    },
  ];
}

export function extractSymptomNarrative(original: string): ClinicalSignalEvidence[] {
  // Catch-all for documented symptoms without a dedicated rule — still deterministic.
  const pain = collectMatches(original, [/\b(pain|aching|hurts)\b/gi]);
  if (!pain.length) return [];
  return [
    {
      key: "symptom_pain",
      label: "Pain or discomfort documented",
      confidence: 0.62,
      evidencePhrases: pain.map((p) => p.phrase),
      spans: pain.map((p) => ({ start: p.start, end: p.end })),
    },
  ];
}

export function extractClinicalSignals(original: string): ClinicalSignalEvidence[] {
  const text = original.trim();
  if (!text) return [];
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  const out: ClinicalSignalEvidence[] = [];

  for (const rule of EXTRACT_RULES) {
    const matches = collectMatches(text, rule.patterns);
    if (!matches.length) continue;
    if (rule.key === "fever_infection" && negatesBefore(lower, "fever")) continue;

    const phrases = matches.map((m) => m.phrase);
    const spans = matches.map((m) => ({ start: m.start, end: m.end }));
    const uniqPhrases = Array.from(new Set(phrases)).slice(0, 6);
    const boost = Math.min(0.15, (uniqPhrases.length - 1) * 0.04);
    out.push({
      key: rule.key,
      label: rule.label,
      confidence: Math.min(0.95, rule.baseConfidence + boost),
      evidencePhrases: uniqPhrases,
      spans: spans.slice(0, 6),
    });
  }

  out.push(...extractLabMentions(text));
  out.push(...extractMedications(text));
  out.push(...extractSymptomNarrative(text));

  // De-dupe by key keeping highest confidence
  const byKey = new Map<string, ClinicalSignalEvidence>();
  for (const s of out) {
    const prev = byKey.get(s.key);
    if (!prev || prev.confidence < s.confidence) byKey.set(s.key, s);
  }
  return Array.from(byKey.values());
}
