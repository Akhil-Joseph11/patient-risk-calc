"use client";

import { useMemo } from "react";

import type { PersistedSignalEvidence } from "@/lib/extraction/enrich-evidence";
import { cn } from "@/lib/utils";

function hueForKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = h % 320;
  return `hsla(${hue}, 70%, 42%, 0.38)`;
}

type CoverPart = {
  start: number;
  end: number;
  text: string;
  sigs: PersistedSignalEvidence[];
};

function buildCoverParts(text: string, evidence: PersistedSignalEvidence[]): CoverPart[] {
  const rawSpans: { start: number; end: number; sig: PersistedSignalEvidence }[] = [];
  for (const sig of evidence) {
    for (const sp of sig.spans || []) {
      if (sp.end > sp.start && sp.start >= 0 && sp.end <= text.length) {
        rawSpans.push({ start: sp.start, end: sp.end, sig });
      }
    }
  }
  if (!rawSpans.length) return [{ start: 0, end: text.length, text, sigs: [] }];

  const cuts = new Set<number>([0, text.length]);
  for (const s of rawSpans) {
    cuts.add(s.start);
    cuts.add(s.end);
  }
  const pts = Array.from(cuts).sort((a, b) => a - b);
  const parts: CoverPart[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const start = pts[i];
    const end = pts[i + 1];
    if (start === end) continue;
    const sigs = rawSpans.filter((r) => r.start <= start && r.end >= end).map((r) => r.sig);
    const uniq: PersistedSignalEvidence[] = [];
    const seenKeys = new Set<string>();
    for (const s of sigs) {
      if (seenKeys.has(s.key)) continue;
      seenKeys.add(s.key);
      uniq.push(s);
    }
    parts.push({ start, end, text: text.slice(start, end), sigs: uniq });
  }
  return parts;
}

function formatSources(s: PersistedSignalEvidence): string {
  const tags = s.evidenceSources || ["rules"];
  return tags.map((t) => (t === "rules" ? "Rules" : t === "ocr" ? "OCR" : "Enrichment")).join(" · ");
}

export function HighlightedClinicalNote({
  text,
  evidence,
  className,
}: {
  text: string;
  evidence: PersistedSignalEvidence[];
  className?: string;
}) {
  const parts = useMemo(() => buildCoverParts(text, evidence), [text, evidence]);

  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-slate-200",
        className
      )}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Raw note · evidence highlights
      </p>
      <p className="whitespace-pre-wrap font-sans">
        {parts.map((p, i) =>
          p.sigs.length ? (
            <span
              key={`${p.start}-${p.end}-${i}`}
              className="rounded-sm px-0.5 ring-1 ring-white/15"
              style={{
                backgroundColor:
                  p.sigs.length === 1
                    ? hueForKey(p.sigs[0].key)
                    : "hsla(210, 55%, 45%, 0.35)",
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
              }}
              title={p.sigs.map((s) => `${s.label} (${formatSources(s)})`).join("\n")}
            >
              {p.text}
            </span>
          ) : (
            <span key={`plain-${p.start}-${i}`}>{p.text}</span>
          )
        )}
      </p>
    </div>
  );
}
