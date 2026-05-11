"use client";

import { useMemo, useState } from "react";
import type { PatientCase } from "@prisma/client";
import { GitBranch, Layers } from "lucide-react";

import { HighlightedClinicalNote } from "@/components/dashboard/highlighted-clinical-note";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { PersistedSignalEvidence } from "@/lib/extraction/enrich-evidence";
import type { ClinicalPipelineTraceEntry } from "@/lib/pipeline/clinical-trace";
import {
  inferReviewStateFromConfidenceOnly,
  reviewStateDisplayLabel,
  type ReviewStateLabel,
} from "@/lib/review-state";

function parseJsonArray(raw: string): string[] {
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j.map(String) : [];
  } catch {
    return [];
  }
}

function parseEvidence(raw: string): PersistedSignalEvidence[] {
  try {
    const j = JSON.parse(raw) as unknown[];
    if (!Array.isArray(j)) return [];
    return j as PersistedSignalEvidence[];
  } catch {
    return [];
  }
}

function parseTrace(raw: string): ClinicalPipelineTraceEntry[] {
  try {
    const j = JSON.parse(raw) as unknown[];
    if (!Array.isArray(j)) return [];
    return j as ClinicalPipelineTraceEntry[];
  } catch {
    return [];
  }
}

function riskBadge(level: string): "high" | "medium" | "low" | "default" {
  if (level === "High") return "high";
  if (level === "Medium") return "medium";
  if (level === "Low") return "low";
  return "default";
}

function reviewBadgeVariant(state: ReviewStateLabel): "reviewHigh" | "reviewMedium" | "reviewNeed" {
  if (state === "high_confidence") return "reviewHigh";
  if (state === "needs_human_review") return "reviewNeed";
  return "reviewMedium";
}

function effectiveReviewState(c: PatientCase): ReviewStateLabel {
  const rs = c.reviewState as ReviewStateLabel | null | undefined;
  if (rs === "high_confidence" || rs === "medium_confidence" || rs === "needs_human_review") return rs;
  return inferReviewStateFromConfidenceOnly(c.analysisConfidence);
}

function mechanismLabel(m: string | undefined): string {
  if (m === "rules") return "Rules";
  if (m === "ocr") return "OCR";
  if (m === "llm") return "Enrichment";
  if (m === "hybrid") return "Blended";
  if (m === "n_a") return "—";
  return "—";
}

type BundleEntry = { resource?: { resourceType?: string; id?: string } };

function groupBundleEntries(structuredRecord: string): Record<string, unknown[]> {
  try {
    const bundle = JSON.parse(structuredRecord) as { entry?: BundleEntry[] };
    const groups: Record<string, unknown[]> = {
      Patient: [],
      Encounter: [],
      Observation: [],
      Condition: [],
      MedicationStatement: [],
      ClinicalNote: [],
      RiskAssessment: [],
      Other: [],
    };
    for (const e of bundle.entry || []) {
      const rt = e.resource?.resourceType || "Other";
      if (rt in groups) (groups[rt] as unknown[]).push(e.resource);
      else groups.Other.push(e.resource);
    }
    return groups;
  } catch {
    return { Patient: [], Encounter: [], Observation: [], Condition: [], MedicationStatement: [], ClinicalNote: [], RiskAssessment: [], Other: [] };
  }
}

function formatSourcesList(s: PersistedSignalEvidence): string {
  const src = s.evidenceSources?.length ? s.evidenceSources : ["rules"];
  return src.map((t) => (t === "rules" ? "Rules" : t === "ocr" ? "OCR" : "Enrichment")).join(" · ");
}

export function CaseDetailSheet({
  selected,
  isGuest,
  ownerLabel,
}: {
  selected: PatientCase;
  isGuest: boolean;
  ownerLabel?: string | null;
}) {
  const [fhirOpen, setFhirOpen] = useState(true);
  const evidence = useMemo(() => parseEvidence(selected.signalEvidence || "[]"), [selected.signalEvidence]);
  const trace = useMemo(() => parseTrace(selected.pipelineTrace || "[]"), [selected.pipelineTrace]);
  const reviewState = useMemo(() => effectiveReviewState(selected), [selected]);
  const bundleGroups = useMemo(() => groupBundleEntries(selected.structuredRecord || "{}"), [selected.structuredRecord]);

  const rawText = selected.rawDocumentText || selected.clinicalNotes;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 bg-gradient-to-br from-sky-500/15 via-transparent to-indigo-500/10 px-6 py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-300/90">Case</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{selected.patientName}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={riskBadge(selected.riskLevel)}>{selected.riskLevel} risk</Badge>
          <Badge variant={reviewBadgeVariant(reviewState)}>{reviewStateDisplayLabel(reviewState)}</Badge>
          <span className="rounded-full bg-black/30 px-3 py-1 text-sm tabular-nums text-slate-200 ring-1 ring-white/10">
            Score {selected.riskScore}/100
          </span>
          <span className="text-sm text-slate-400">Age {selected.age}</span>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400 ring-1 ring-white/10">
            {selected.inputSource || "paste"}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>
            Extraction confidence (heuristic):{" "}
            <span className="font-mono text-slate-200">{selected.analysisConfidence ?? "—"}</span>/100
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
        <section>
          <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            <GitBranch className="h-3.5 w-3.5" />
            Pipeline trace
          </h3>
          <p className="mt-1 text-xs text-slate-500">Stages from intake through scoring. Tags indicate rules, capture path, or blended enrichment.</p>
          {trace.length ? (
            <ol className="mt-3 space-y-2">
              {trace.map((t, idx) => (
                <li
                  key={`${t.order ?? idx}-${t.stage ?? t.id ?? idx}`}
                  className={cn(
                    "flex gap-3 rounded-lg border px-3 py-2.5 text-xs",
                    t.status === "error"
                      ? "border-red-400/30 bg-red-500/10 text-red-100"
                      : t.status === "warn"
                        ? "border-amber-400/25 bg-amber-500/10 text-amber-50"
                        : "border-white/10 bg-white/[0.03] text-slate-300"
                  )}
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 font-mono text-[10px] text-slate-200">
                    {t.order ?? idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-100">{t.title}</p>
                      <span className="rounded-md bg-black/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-200/90 ring-1 ring-white/10">
                        {mechanismLabel(t.mechanism)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-slate-500">{t.stage ?? t.id ?? "step"}</span>
                    </div>
                    <p className="mt-1 leading-snug text-slate-400">{t.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No trace stored for this case.</p>
          )}
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Signals & evidence
          </h3>
          {evidence.length ? (
            <ul className="mt-3 space-y-3">
              {evidence.map((row, idx) => (
                <li
                  key={`${row.key ?? row.label ?? idx}`}
                  className="rounded-xl border border-sky-400/20 bg-sky-500/5 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-sky-100">{row.label || row.key}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-black/35 px-2 py-0.5 text-[10px] text-slate-300 ring-1 ring-white/10">
                        {formatSourcesList(row)}
                      </span>
                      {row.confidence != null ? (
                        <span className="text-[11px] tabular-nums text-slate-400">
                          signal {(row.confidence * 100).toFixed(0)}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {row.evidencePhrases?.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-slate-300">
                      {row.evidencePhrases.map((p) => (
                        <li key={p} className="rounded-md bg-black/30 px-2 py-1 font-mono ring-1 ring-white/10">
                          “{p}”
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No evidence metadata on this case.</p>
          )}
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Labels</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {parseJsonArray(selected.signals).map((s) => (
              <li
                key={s}
                className="rounded-xl border border-slate-500/30 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200"
              >
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Explanation</h3>
          <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-[13px] leading-relaxed text-slate-300">
            <p className="whitespace-pre-wrap">{selected.explanation}</p>
          </div>
        </section>

        <section>
          <HighlightedClinicalNote text={rawText} evidence={evidence} />
        </section>

        {selected.ocrText ? (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">OCR text</h3>
            <p className="mt-2 whitespace-pre-wrap rounded-xl border border-amber-400/15 bg-amber-500/5 p-4 text-sm leading-relaxed text-slate-200">
              {selected.ocrText}
            </p>
          </section>
        ) : null}

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Note (extraction input)
          </h3>
          <p className="mt-2 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-slate-200">
            {selected.clinicalNotes}
          </p>
        </section>

        <section>
          <button
            type="button"
            onClick={() => setFhirOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-medium text-slate-100 transition hover:bg-white/[0.07]"
          >
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-emerald-400" />
              Structured bundle
            </span>
            <span className="text-xs text-slate-500">{fhirOpen ? "Collapse" : "Expand"}</span>
          </button>
          {fhirOpen ? (
            <div className="mt-3 space-y-3">
              {(
                [
                  ["Patient", bundleGroups.Patient],
                  ["Encounter", bundleGroups.Encounter],
                  ["Observation", bundleGroups.Observation],
                  ["Condition", bundleGroups.Condition],
                  ["MedicationStatement", bundleGroups.MedicationStatement],
                  ["ClinicalNote", bundleGroups.ClinicalNote],
                  ["RiskAssessment", bundleGroups.RiskAssessment],
                ] as const
              ).map(([title, rows]) =>
                rows.length ? (
                  <div key={title} className="rounded-xl border border-white/10 bg-black/30 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400/90">{title}</p>
                    <ul className="mt-2 space-y-2">
                      {rows.map((r, i) => (
                        <li key={i}>
                          <pre className="max-h-40 overflow-auto rounded-lg bg-black/40 p-2 text-[11px] leading-relaxed text-slate-200">
                            {JSON.stringify(r, null, 2)}
                          </pre>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}
              {bundleGroups.Other.length ? (
                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Other</p>
                  <pre className="mt-2 max-h-32 overflow-auto text-[11px] text-slate-400">
                    {JSON.stringify(bundleGroups.Other, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <Separator />

        <section className="grid gap-2 text-sm text-slate-400">
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Created</span>
            <span className="text-right text-slate-200">{new Date(selected.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Assigned clinician</span>
            <span className="text-right text-slate-200">{selected.assignedClinician || "—"}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-slate-500">Persistence</span>
            <span className="text-right text-xs text-slate-300">
              {isGuest ? "Guest session (browser cookie)" : "Clerk account"}
            </span>
          </div>
          {!isGuest ? (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Case owner</span>
              <span className="text-right text-xs text-slate-300">{ownerLabel || selected.clerkUserId || "—"}</span>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
