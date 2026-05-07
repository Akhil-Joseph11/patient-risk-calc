type SignalRule = {
  label: string;
  patterns: RegExp[];
  weight: number;
};

const RULES: SignalRule[] = [
  {
    label: "Significant unintentional weight loss",
    patterns: [
      /\b(lost|loss of|losing)\s+\d+\s*kg\b/i,
      /\b\d+\s*kg\s+(lost|loss)\b/i,
      /\b(weight|wt\.?)\s+(loss|down|decreased)\b/i,
      /\bunintentional\s+weight\b/i,
      /\bcachexia\b/i,
      /\bwasting\b/i,
    ],
    weight: 28,
  },
  {
    label: "Poor or reduced appetite",
    patterns: [
      /\bpoor\s+appetite\b/i,
      /\b(decreased|reduced|loss of)\s+appetite\b/i,
      /\blow\s+intake\b/i,
      /\banorexia\b/i,
      /\bnot\s+eating\b/i,
    ],
    weight: 22,
  },
  {
    label: "Fatigue or weakness",
    patterns: [/\bfatigue\b/i, /\b(tired|exhausted|lethargic|weakness|malaise)\b/i, /\blow\s+energy\b/i],
    weight: 18,
  },
  {
    label: "Nausea, vomiting, or GI distress",
    patterns: [/\b(nausea|vomiting|emesis)\b/i, /\b(dyspepsia|abdominal\s+pain)\b/i],
    weight: 15,
  },
  {
    label: "Fever or infection concern",
    patterns: [/\bfever\b/i, /\bfebrile\b/i, /\binfection\b/i, /\bsepsis\b/i],
    weight: 20,
  },
  {
    label: "Dyspnea or respiratory symptoms",
    patterns: [/\b(shortness of breath|sob|dyspnea)\b/i, /\bhypoxia\b/i, /\boxygen\b/i],
    weight: 18,
  },
  {
    label: "Confusion or altered mental status",
    patterns: [/\b(confusion|altered mental status|ams|delirium)\b/i, /\bdisoriented\b/i],
    weight: 22,
  },
  {
    label: "Stable nutrition and recovery (protective)",
    patterns: [
      /\bstable\s+weight\b/i,
      /\bnormal\s+intake\b/i,
      /\brecovering\s+well\b/i,
      /\bdoing\s+well\b/i,
      /\bastable\b/i,
    ],
    weight: -12,
  },
];

export type AnalysisResultInternal = {
  signals: string[];
  risk_score: number;
  explanation: string;
};

export function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegex(keyword: string): string {
  return keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Rough heuristic: 'denies fever', 'no fever', etc. should not flag the keyword. */
export function negatesBefore(text: string, keyword: string): boolean {
  const re = new RegExp(
    `\\b(denies|deny|denied|no|without|negative for|absence of)\\s+(\\w+\\s+){0,4}${escapeRegex(keyword)}\\b`,
    "i"
  );
  return re.test(text);
}

export function buildExplanation(signals: string[], score: number, notes: string): string {
  const lead =
    `Risk score ${score}/100 based on phrases in the note. ` +
    `Key themes: ${signals.slice(0, 5).join(", ")}` +
    (signals.length > 5 ? "…" : "") +
    ".";

  let tail: string;
  if (score >= 70) {
    tail = " Several concerning findings suggest prioritizing follow-up and closer monitoring.";
  } else if (score >= 45) {
    tail = " Mixed or moderate findings warrant routine follow-up and clarification if symptoms worsen.";
  } else {
    tail = " Overall picture from this snippet is lower concern relative to higher-risk patterns.";
  }

  let snippet = notes.trim().replace(/\n/g, " ");
  if (snippet.length > 160) snippet = snippet.slice(0, 157) + "…";
  return `${lead} Context: “${snippet}”${tail}`;
}

export function analyzeWithRulesRaw(notes: string): AnalysisResultInternal {
  const text = normalize(notes);
  const matched: string[] = [];
  let score = 35;

  for (const rule of RULES) {
    for (const pat of rule.patterns) {
      if (!pat.test(text)) continue;
      if (rule.label.startsWith("Fever") && negatesBefore(text, "fever")) continue;
      if (!matched.includes(rule.label)) matched.push(rule.label);
      score += rule.weight;
      break;
    }
  }

  score = Math.max(0, Math.min(100, score));

  if (!matched.length) {
    matched.push("No strong risk or protective phrases detected in notes");
  }

  const explanation = buildExplanation(matched, score, notes);
  return { signals: matched, risk_score: score, explanation };
}
