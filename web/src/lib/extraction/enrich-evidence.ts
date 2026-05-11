import type { ClinicalSignalEvidence } from "@/lib/extraction/clinical-signals";

/** Provenance: rules extraction, document capture path, optional enriched scoring. */
export type EvidenceSourceTag = "rules" | "ocr" | "llm";

export type PersistedSignalEvidence = ClinicalSignalEvidence & {
  evidenceSources: EvidenceSourceTag[];
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Finds evidence phrase spans in the raw document for highlighting. */
export function findPhraseSpansInRaw(raw: string, phrases: string[], maxMatchesTotal = 24): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  const seen = new Set<string>();

  for (const phrase of phrases) {
    const p = phrase.trim();
    if (p.length < 2) continue;
    let from = 0;
    let perPhrase = 0;
    while (from < raw.length && perPhrase < 3 && spans.length < maxMatchesTotal) {
      let idx = raw.indexOf(p, from);
      let matchedLen = p.length;
      if (idx === -1) {
        const re = new RegExp(escapeRegExp(p), "i");
        const m = re.exec(raw.slice(from));
        if (!m || m.index === undefined) break;
        idx = from + m.index;
        matchedLen = m[0].length;
      }
      const end = idx + matchedLen;
      const key = `${idx}:${end}`;
      if (!seen.has(key)) {
        seen.add(key);
        spans.push({ start: idx, end });
      }
      from = idx + Math.max(1, matchedLen);
      perPhrase++;
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

function mergeSpans(spans: { start: number; end: number }[]): { start: number; end: number }[] {
  if (!spans.length) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: { start: number; end: number }[] = [];
  let cur = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.start <= cur.end) cur = { start: cur.start, end: Math.max(cur.end, s.end) };
    else {
      out.push(cur);
      cur = s;
    }
  }
  out.push(cur);
  return out;
}

/** Tags signals with provenance and aligns spans to the raw document string. */
export function enrichSignalsForPersistence(
  extraction: ClinicalSignalEvidence[],
  opts: {
    rawDocumentText: string;
    clinicalNotes: string;
    inputSource: string;
    llmScoring: boolean;
  }
): PersistedSignalEvidence[] {
  const raw = opts.rawDocumentText.trim();
  const clinical = opts.clinicalNotes.trim();
  const sameBody = raw === clinical;
  const ocrish = opts.inputSource === "image" || opts.inputSource === "pdf";

  return extraction.map((sig) => {
    const sources: EvidenceSourceTag[] = ["rules"];
    if (ocrish) sources.push("ocr");
    if (opts.llmScoring) sources.push("llm");

    let spans: { start: number; end: number }[];
    if (sameBody) {
      spans = sig.spans?.length ? mergeSpans(sig.spans) : findPhraseSpansInRaw(raw, sig.evidencePhrases);
    } else {
      spans = mergeSpans(findPhraseSpansInRaw(raw, sig.evidencePhrases));
    }

    return {
      ...sig,
      evidenceSources: Array.from(new Set(sources)) as EvidenceSourceTag[],
      spans: spans.length ? spans : undefined,
    };
  });
}
