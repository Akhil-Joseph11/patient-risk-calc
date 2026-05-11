"use client";

import { useMemo } from "react";
import type { PatientCase } from "@prisma/client";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { inferReviewStateFromConfidenceOnly, type ReviewStateLabel } from "@/lib/review-state";

function effectiveReviewState(c: PatientCase): ReviewStateLabel {
  const r = c.reviewState;
  if (r === "high_confidence" || r === "medium_confidence" || r === "needs_human_review") return r;
  return inferReviewStateFromConfidenceOnly(c.analysisConfidence);
}

function parseSignals(raw: string): string[] {
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j.map(String) : [];
  } catch {
    return [];
  }
}

function parseEvidenceLabels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown[];
    if (!Array.isArray(j)) return [];
    return j
      .map((x) => {
        if (x && typeof x === "object" && "label" in x) return String((x as { label?: string }).label ?? "");
        return "";
      })
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

type InsightsStats = {
  total: number;
  high: number;
  medium: number;
  low: number;
  reviewNeedsHuman: number;
  reviewHigh: number;
  reviewMedium: number;
  avgConfidence: number;
  topSignals: [string, number][];
  trendLabel: string;
  TrendIcon: typeof TrendingUp;
};

function computeInsights(cases: PatientCase[]): InsightsStats {
  const total = cases.length;
  let high = 0;
  let medium = 0;
  let low = 0;
  let reviewNeedsHuman = 0;
  let reviewHigh = 0;
  let reviewMedium = 0;
  let confSum = 0;
  for (const c of cases) {
    if (c.riskLevel === "High") high++;
    else if (c.riskLevel === "Medium") medium++;
    else if (c.riskLevel === "Low") low++;
    const rv = effectiveReviewState(c);
    if (rv === "needs_human_review") reviewNeedsHuman++;
    else if (rv === "high_confidence") reviewHigh++;
    else reviewMedium++;
    confSum += c.analysisConfidence ?? 0;
  }
  const avgConfidence = total ? Math.round(confSum / total) : 0;

  const counts = new Map<string, number>();
  for (const c of cases) {
    const labels = Array.from(
      new Set([...parseSignals(c.signals), ...parseEvidenceLabels(c.signalEvidence)])
    );
    for (const s of labels) {
      const key = s.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const topSignals = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = cases.filter((c) => now - new Date(c.createdAt).getTime() <= week).length;
  const prevWeek = cases.filter((c) => {
    const age = now - new Date(c.createdAt).getTime();
    return age > week && age <= 2 * week;
  }).length;

  let trendLabel = "";
  let TrendIcon: typeof TrendingUp = Minus;
  if (total === 0) {
    trendLabel = "No cases yet — add rows or load samples to see trends.";
  } else if (prevWeek === 0 && thisWeek > 0) {
    trendLabel = `${thisWeek} new case(s) in the last 7 days.`;
    TrendIcon = TrendingUp;
  } else if (thisWeek > prevWeek) {
    trendLabel = `Up vs prior week (${thisWeek} vs ${prevWeek} new).`;
    TrendIcon = TrendingUp;
  } else if (thisWeek < prevWeek) {
    trendLabel = `Down vs prior week (${thisWeek} vs ${prevWeek} new).`;
    TrendIcon = TrendingDown;
  } else {
    trendLabel = `${thisWeek} case(s) added this week (same as prior week).`;
    TrendIcon = Minus;
  }

  return {
    total,
    high,
    medium,
    low,
    reviewNeedsHuman,
    reviewHigh,
    reviewMedium,
    avgConfidence,
    topSignals,
    trendLabel,
    TrendIcon,
  };
}

export function InsightsPanel({
  cases,
  loading,
  className,
}: {
  cases: PatientCase[];
  loading: boolean;
  className?: string;
}) {
  const stats = useMemo(() => computeInsights(cases), [cases]);
  const TrendIcon = stats.TrendIcon;

  if (loading) {
    return (
      <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)}>
        <Skeleton className="h-36 min-h-[9rem] rounded-xl" />
        <Skeleton className="h-36 min-h-[9rem] rounded-xl" />
        <Skeleton className="h-36 min-h-[9rem] rounded-xl md:col-span-2 xl:col-span-1" />
      </div>
    );
  }

  const highPct = stats.total ? Math.round((stats.high / stats.total) * 100) : 0;
  const medPct = stats.total ? Math.round((stats.medium / stats.total) * 100) : 0;
  const lowPct = stats.total ? Math.round((stats.low / stats.total) * 100) : 0;

  return (
    <div className={cn("grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-3", className)}>
      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-400/90">
          Snapshot
        </p>
        <p className="mt-2 text-lg font-semibold tabular-nums text-slate-100">
          Total cases: <span className="text-white">{stats.total}</span>
        </p>
        <ul className="mt-3 space-y-1.5 text-[13px] text-slate-300">
          <li className="flex justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" aria-hidden />
              <span>
                High: <strong className="text-red-300">{stats.high}</strong>
              </span>
            </span>
            {stats.total > 0 ? <span className="text-slate-500">{highPct}%</span> : null}
          </li>
          <li className="flex justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden />
              <span>
                Medium: <strong className="text-amber-200">{stats.medium}</strong>
              </span>
            </span>
            {stats.total > 0 ? <span className="text-slate-500">{medPct}%</span> : null}
          </li>
          <li className="flex justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden />
              <span>
                Low: <strong className="text-emerald-300">{stats.low}</strong>
              </span>
            </span>
            {stats.total > 0 ? <span className="text-slate-500">{lowPct}%</span> : null}
          </li>
        </ul>

        {stats.total > 0 ? (
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-black/40">
            <div className="bg-red-400/90" style={{ width: `${highPct}%` }} />
            <div className="bg-amber-400/90" style={{ width: `${medPct}%` }} />
            <div className="bg-emerald-400/90" style={{ width: `${lowPct}%` }} />
          </div>
        ) : null}

        {stats.total > 0 ? (
          <div className="mt-4 border-t border-white/10 pt-3 text-[12px] text-slate-400">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Review & confidence</p>
            <ul className="mt-2 space-y-1">
              <li className="flex justify-between gap-2">
                <span>Needs human review</span>
                <strong className="text-violet-200">{stats.reviewNeedsHuman}</strong>
              </li>
              <li className="flex justify-between gap-2">
                <span>High / medium confidence</span>
                <span className="tabular-nums text-slate-300">
                  {stats.reviewHigh} / {stats.reviewMedium}
                </span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Avg extraction confidence</span>
                <span className="tabular-nums text-slate-300">{stats.avgConfidence}/100</span>
              </li>
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Trends
        </p>
        <div className="mt-2 flex gap-2 text-slate-300">
          <TrendIcon className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
          <p className="leading-snug">{stats.trendLabel}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Top signals
        </p>
        {stats.topSignals.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">No extracted signals yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-[13px] text-slate-300">
            {stats.topSignals.slice(0, 6).map(([label, n]) => (
              <li key={label} className="flex justify-between gap-2 border-b border-white/[0.06] pb-1.5 last:border-0 last:pb-0">
                <span className="truncate text-slate-200">{label}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {n} patient{n === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
