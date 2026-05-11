"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  LayoutGrid,
  Plus,
  Search,
  Sparkles,
  Stethoscope,
  Loader2,
} from "lucide-react";
import type { PatientCase } from "@prisma/client";
import Link from "next/link";

import { CaseDetailSheet } from "@/components/dashboard/case-detail-sheet";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { NewCaseDialog } from "@/components/dashboard/new-case-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  inferReviewStateFromConfidenceOnly,
  reviewStateDisplayLabel,
  type ReviewStateLabel,
} from "@/lib/review-state";

function effectiveReviewState(c: PatientCase): ReviewStateLabel {
  const r = c.reviewState;
  if (r === "high_confidence" || r === "medium_confidence" || r === "needs_human_review") return r;
  return inferReviewStateFromConfidenceOnly(c.analysisConfidence);
}

function reviewBadgeVariant(state: ReviewStateLabel): "reviewHigh" | "reviewMedium" | "reviewNeed" {
  if (state === "high_confidence") return "reviewHigh";
  if (state === "needs_human_review") return "reviewNeed";
  return "reviewMedium";
}

function parseJsonArray(raw: string): string[] {
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j.map(String) : [];
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

export function CaseQueue() {
  const { user } = useUser();
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [reviewFilter, setReviewFilter] = useState<string>("all");
  const [sortRisk, setSortRisk] = useState<"desc" | "asc">("desc");
  const [selected, setSelected] = useState<PatientCase | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navTab, setNavTab] = useState<"cases" | "insights">("cases");
  const [seedBusy, setSeedBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cases", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Could not load assigned cases");
      const data = await res.json();
      setCases(data.cases ?? []);
      setIsGuest(Boolean(data.guest));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading cases");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let rows = [...cases];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) => {
        const signals = parseJsonArray(c.signals).join(" ").toLowerCase();
        const raw = (c.rawDocumentText || c.clinicalNotes || "").toLowerCase();
        return c.patientName.toLowerCase().includes(q) || signals.includes(q) || raw.includes(q);
      });
    }
    if (riskFilter !== "all") {
      rows = rows.filter((c) => c.riskLevel === riskFilter);
    }
    if (reviewFilter === "needs_review") {
      rows = rows.filter((c) => effectiveReviewState(c) === "needs_human_review");
    } else if (reviewFilter === "low_confidence") {
      rows = rows.filter((c) => (c.analysisConfidence ?? 0) < 58);
    }
    rows.sort((a, b) => (sortRisk === "desc" ? b.riskScore - a.riskScore : a.riskScore - b.riskScore));
    return rows;
  }, [cases, search, riskFilter, reviewFilter, sortRisk]);

  async function loadSampleCases() {
    setSeedBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cases/seed-demo", { method: "POST", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not load samples");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load samples");
    } finally {
      setSeedBusy(false);
    }
  }

  function openDetail(c: PatientCase) {
    setSelected(c);
    setSheetOpen(true);
  }

  const ownerLabel = user?.primaryEmailAddress?.emailAddress ?? user?.username ?? null;

  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden min-h-screen w-[280px] shrink-0 flex-col border-r border-white/10 bg-black/20 px-4 py-6 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-[0_0_24px_-6px_rgba(56,189,248,0.65)]">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-300/90">Patient RiskCalc</p>
          </div>
        </div>
        <Separator className="my-6 opacity-60" />
        <nav className="flex flex-1 flex-col gap-1 px-1">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
          <button
            type="button"
            onClick={() => setNavTab("cases")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              navTab === "cases"
                ? "bg-white/[0.07] text-slate-100 ring-1 ring-white/10"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            )}
          >
            <LayoutGrid className="h-4 w-4 text-sky-400" />
            Care queue
          </button>
          <button
            type="button"
            onClick={() => setNavTab("insights")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              navTab === "insights"
                ? "bg-white/[0.07] text-slate-100 ring-1 ring-white/10"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            )}
          >
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            Insights
          </button>

          <p className="mt-6 px-2 text-[11px] leading-relaxed text-slate-500">
            Notes, structured output, risk, and detail in one workspace.
          </p>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#07090f]/80 px-4 py-4 backdrop-blur-xl sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-400/90">Patient RiskCalc</p>
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">
              {navTab === "cases" ? "Care queue" : "Insights"}
            </h1>
            <p className="text-sm text-slate-500">
              {navTab === "cases"
                ? "Guests use a private empty queue until they add cases or load samples; sign in to save under your account."
                : "Aggregated view of cases in this workspace."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <SignedOut>
              <SignInButton mode="modal" forceRedirectUrl="/dashboard">
                <Button variant="secondary" size="sm" className="rounded-xl">
                  Sign in to save
                </Button>
              </SignInButton>
            </SignedOut>
            <NewCaseDialog
              trigger={
                <Button className="rounded-xl shadow-lg shadow-sky-500/10">
                  <Plus className="h-4 w-4" />
                  New case
                </Button>
              }
              onCaseCreated={(created) => {
                void load();
                setSelected(created);
                setSheetOpen(true);
              }}
              onError={(msg) => {
                if (msg) setError(msg);
              }}
            />
            <SignedIn>
              <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
            </SignedIn>
          </div>
        </header>

        {isGuest ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100 sm:px-8"
          >
            <span className="font-medium">Guest mode</span> — cases stay on this browser via a secure cookie.{" "}
            <SignInButton mode="modal" forceRedirectUrl="/dashboard">
              <button type="button" className="underline decoration-sky-300/80 underline-offset-2 hover:text-white">
                Sign in
              </button>
            </SignInButton>{" "}
            to attach future cases to your account.
          </motion.div>
        ) : null}

        <div className="flex gap-2 border-b border-white/10 bg-[#07090f]/95 px-4 py-2 backdrop-blur-xl sm:px-8 lg:hidden">
          <button
            type="button"
            onClick={() => setNavTab("cases")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold uppercase tracking-wide transition-colors sm:text-[13px]",
              navTab === "cases"
                ? "bg-white/[0.08] text-white ring-1 ring-white/12"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
            )}
          >
            <LayoutGrid className="h-4 w-4 shrink-0 text-sky-400" />
            Cases
          </button>
          <button
            type="button"
            onClick={() => setNavTab("insights")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold uppercase tracking-wide transition-colors sm:text-[13px]",
              navTab === "insights"
                ? "bg-white/[0.08] text-white ring-1 ring-white/12"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
            )}
          >
            <BarChart3 className="h-4 w-4 shrink-0 text-emerald-400" />
            Insights
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-8">
          {navTab === "cases" ? (
            <Card className="overflow-hidden border-white/10">
              <CardHeader className="gap-4 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Stethoscope className="h-4 w-4 text-sky-400" />
                    Care case queue
                  </CardTitle>
                  <CardDescription>
                    Filter by risk or review state. Open a row for the note, evidence, and trace.
                  </CardDescription>
                </div>
                <div className="flex w-full flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
                  <div className="relative min-w-0 flex-1 lg:min-w-[12rem]">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      className="rounded-xl pl-9"
                      placeholder="Search patient or note text…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="w-full rounded-xl lg:w-[150px]">
                      <SelectValue placeholder="Risk level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All risk levels</SelectItem>
                      <SelectItem value="High">High risk</SelectItem>
                      <SelectItem value="Medium">Medium risk</SelectItem>
                      <SelectItem value="Low">Low risk</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={reviewFilter} onValueChange={setReviewFilter}>
                    <SelectTrigger className="w-full rounded-xl lg:w-[200px]">
                      <SelectValue placeholder="Review" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All review states</SelectItem>
                      <SelectItem value="needs_review">Needs human review</SelectItem>
                      <SelectItem value="low_confidence">Low confidence (under 58)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortRisk} onValueChange={(v) => setSortRisk(v as "desc" | "asc")}>
                    <SelectTrigger className="w-full rounded-xl lg:w-[170px]">
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="desc">Risk score · High → Low</SelectItem>
                      <SelectItem value="asc">Risk score · Low → High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                {error ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 flex flex-col items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-50"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      {error}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => void load()}>
                        Refresh cases
                      </Button>
                      <Button variant="ghost" size="sm" className="rounded-lg text-slate-200" asChild>
                        <Link href="/">Back home</Link>
                      </Button>
                    </div>
                  </motion.div>
                ) : null}

                {loading ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-44 rounded-2xl" />
                    ))}
                  </div>
                ) : filtered.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center"
                  >
                    <div className="rounded-full border border-white/10 bg-black/30 p-4">
                      <Activity className="h-8 w-8 text-sky-400" />
                    </div>
                    <div className="max-w-md space-y-2 px-4">
                      <h2 className="text-lg font-semibold text-slate-100">No cases here</h2>
                      <p className="text-sm text-slate-400">
                        Add a case or load samples below. Nothing is inserted automatically.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-3">
                      <NewCaseDialog
                        trigger={
                          <Button variant="secondary" className="rounded-xl">
                            <Plus className="h-4 w-4" />
                            New patient case
                          </Button>
                        }
                        onCaseCreated={(created) => {
                          void load();
                          setSelected(created);
                          setSheetOpen(true);
                        }}
                        onError={(msg) => {
                          if (msg) setError(msg);
                        }}
                      />
                      <Button
                        variant="ghost"
                        className="rounded-xl border border-white/10 text-slate-300"
                        disabled={seedBusy}
                        onClick={() => void loadSampleCases()}
                      >
                        {seedBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Load samples
                      </Button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.ul layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {filtered.map((c) => (
                        <motion.li
                          layout
                          key={c.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ type: "spring", stiffness: 380, damping: 28 }}
                          className="list-none"
                        >
                          <button
                            type="button"
                            onClick={() => openDetail(c)}
                            className={cn(
                              "group relative w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition-all hover:bg-white/[0.06]",
                              c.riskLevel === "High" &&
                                "border-red-400/25 shadow-[0_0_40px_-18px_rgba(248,113,113,0.55)]",
                              c.riskLevel === "Medium" &&
                                "border-amber-400/20 shadow-[0_0_36px_-18px_rgba(251,191,36,0.35)]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-lg font-semibold text-slate-50">{c.patientName}</p>
                                <p className="text-xs uppercase tracking-wider text-slate-500">
                                  Age {c.age} · {(c.inputSource || "paste").toUpperCase()}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <Badge variant={riskBadge(c.riskLevel)}>{c.riskLevel} risk</Badge>
                                <Badge variant={reviewBadgeVariant(effectiveReviewState(c))} className="text-[10px]">
                                  {reviewStateDisplayLabel(effectiveReviewState(c))}
                                </Badge>
                              </div>
                            </div>
                            <div className="mt-4 flex items-end justify-between gap-3">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                                  Risk score
                                </p>
                                <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-50">
                                  {c.riskScore}
                                </p>
                                <p className="mt-1 text-[10px] text-slate-500">
                                  Confidence {c.analysisConfidence ?? "—"}/100
                                </p>
                              </div>
                              <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-hover:-rotate-90 group-hover:text-sky-400" />
                            </div>
                            <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-slate-400">
                              {c.rawDocumentText || c.clinicalNotes}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-1.5">
                              {parseJsonArray(c.tags)
                                .slice(0, 4)
                                .map((t) => (
                                  <span
                                    key={t}
                                    className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] text-slate-400 ring-1 ring-white/10"
                                  >
                                    {t}
                                  </span>
                                ))}
                            </div>
                          </button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden border-white/10">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-emerald-400" />
                  Insights
                </CardTitle>
                <CardDescription>Counts and top signals for the cases above.</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="pt-6">
                <InsightsPanel cases={cases} loading={loading} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto p-0 sm:max-w-lg">
          {selected ? (
            <CaseDetailSheet selected={selected} isGuest={isGuest} ownerLabel={ownerLabel} />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
