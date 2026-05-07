"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserButton, useUser } from "@clerk/nextjs";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { cn } from "@/lib/utils";

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
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [sortRisk, setSortRisk] = useState<"desc" | "asc">("desc");
  const [selected, setSelected] = useState<PatientCase | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [navTab, setNavTab] = useState<"cases" | "insights">("cases");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const [form, setForm] = useState({
    patientName: "",
    age: "",
    clinicalNotes: "",
    tags: "",
    assignedClinician: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cases");
      if (!res.ok) throw new Error("Could not load assigned cases");
      const data = await res.json();
      setCases(data.cases ?? []);
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
        return (
          c.patientName.toLowerCase().includes(q) ||
          signals.includes(q) ||
          c.clinicalNotes.toLowerCase().includes(q)
        );
      });
    }
    if (riskFilter !== "all") {
      rows = rows.filter((c) => c.riskLevel === riskFilter);
    }
    rows.sort((a, b) => (sortRisk === "desc" ? b.riskScore - a.riskScore : a.riskScore - b.riskScore));
    return rows;
  }, [cases, search, riskFilter, sortRisk]);

  async function seedDemo() {
    setSeedBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/cases/seed-demo", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Seed failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Seed failed");
    } finally {
      setSeedBusy(false);
    }
  }

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tags =
        form.tags.trim() === ""
          ? []
          : form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: form.patientName.trim(),
          age: Number(form.age),
          clinicalNotes: form.clinicalNotes.trim(),
          tags,
          assignedClinician: form.assignedClinician.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not create care case");
      setDialogOpen(false);
      setForm({
        patientName: "",
        age: "",
        clinicalNotes: "",
        tags: "",
        assignedClinician: "",
      });
      await load();
      const created = body.case as PatientCase;
      if (created) {
        setSelected(created);
        setSheetOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function openDetail(c: PatientCase) {
    setSelected(c);
    setSheetOpen(true);
  }

  return (
    <div className="flex min-h-screen">
      <aside className="relative hidden min-h-screen w-[280px] shrink-0 flex-col border-r border-white/10 bg-black/20 px-4 py-6 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-[0_0_24px_-6px_rgba(56,189,248,0.65)]">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-300/90">
              Patient RiskCalc
            </p>
          </div>
        </div>
        <Separator className="my-6 opacity-60" />
        <nav className="flex flex-1 flex-col gap-1 px-1">
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            Workspace
          </p>
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
            Assigned cases
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
            Insights · Summary
            <span className="ml-auto rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-200">
              Rec
            </span>
          </button>

          <p className="mt-6 px-2 text-[11px] leading-relaxed text-slate-500">
            Opens in the main panel: your case queue or cohort insights (risk mix, trends, top signals).
          </p>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-white/10 bg-[#07090f]/80 px-4 py-4 backdrop-blur-xl sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-sky-400/90">
              Patient RiskCalc
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-slate-50">
              {navTab === "cases" ? "Assigned patient cases" : "Insights · Summary"}
            </h1>
            <p className="text-sm text-slate-500">
              {navTab === "cases"
                ? "Prioritize care cases using clinical notes, risk score, and model rationale."
                : "Cohort snapshot: totals, risk band mix, intake trends, and aggregated signals across your assigned cases."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl shadow-lg shadow-sky-500/10">
                  <Plus className="h-4 w-4" />
                  New case
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 sm:max-w-lg">
                <DialogTitle>New patient case</DialogTitle>
                <DialogDescription>
                  Capture demographics and unstructured clinical notes. RiskCalc runs analysis and attaches
                  signals plus explanation to your assigned queue.
                </DialogDescription>
                <form className="mt-2 flex flex-col gap-4" onSubmit={createCase}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="patientName">Patient name</Label>
                      <Input
                        id="patientName"
                        required
                        placeholder="e.g. Jordan Lee"
                        value={form.patientName}
                        onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        required
                        type="number"
                        min={0}
                        max={120}
                        placeholder="years"
                        value={form.age}
                        onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Clinical note text</Label>
                    <Textarea
                      id="notes"
                      required
                      placeholder="Paste unstructured progress note, phone encounter, or handoff…"
                      value={form.clinicalNotes}
                      onChange={(e) => setForm((f) => ({ ...f, clinicalNotes: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="tags">Tags (optional)</Label>
                      <Input
                        id="tags"
                        placeholder="Comma-separated e.g. nutrition, cardiology"
                        value={form.tags}
                        onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assigned">Assigned clinician (optional)</Label>
                      <Input
                        id="assigned"
                        placeholder="Display name"
                        value={form.assignedClinician}
                        onChange={(e) => setForm((f) => ({ ...f, assignedClinician: e.target.value }))}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={saving} className="w-full rounded-xl">
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analyzing note…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Save & analyze care case
                      </>
                    )}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
          </div>
        </header>

        <div className="flex gap-2 border-b border-white/10 bg-[#07090f]/95 px-4 py-2 backdrop-blur-xl lg:hidden sm:px-8">
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
                  Filter by risk level, search by patient name or extracted signals, sort by risk score.
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    className="rounded-xl pl-9"
                    placeholder="Search patient or signal…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-full rounded-xl sm:w-[160px]">
                    <SelectValue placeholder="Risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All risk levels</SelectItem>
                    <SelectItem value="High">High risk</SelectItem>
                    <SelectItem value="Medium">Medium risk</SelectItem>
                    <SelectItem value="Low">Low risk</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortRisk} onValueChange={(v) => setSortRisk(v as "desc" | "asc")}>
                  <SelectTrigger className="w-full rounded-xl sm:w-[170px]">
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
                  className="flex flex-col items-start gap-3 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-4 text-sm text-red-100"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    {error}
                  </div>
                  <Button variant="secondary" size="sm" className="rounded-lg" onClick={() => void load()}>
                    Retry
                  </Button>
                </motion.div>
              ) : null}

              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
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
                    <h2 className="text-lg font-semibold text-slate-100">No assigned patient cases yet</h2>
                    <p className="text-sm text-slate-400">
                      Create a care case from clinical notes or load curated demo cases for this account (once).
                      Your queue is always scoped to your Clerk identity — other clinicians never see your rows.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button variant="secondary" className="rounded-xl" onClick={() => setDialogOpen(true)}>
                      <Plus className="h-4 w-4" />
                      New patient case
                    </Button>
                    <Button
                      variant="ghost"
                      className="rounded-xl border border-white/10 text-slate-300"
                      disabled={seedBusy}
                      onClick={() => void seedDemo()}
                    >
                      {seedBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Load demo cases
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
                                Age {c.age} · Care case
                              </p>
                            </div>
                            <Badge variant={riskBadge(c.riskLevel)}>{c.riskLevel} risk</Badge>
                          </div>
                          <div className="mt-4 flex items-end justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                                Risk score
                              </p>
                              <p className="text-3xl font-semibold tabular-nums tracking-tight text-slate-50">
                                {c.riskScore}
                              </p>
                            </div>
                            <ChevronDown className="h-5 w-5 text-slate-600 transition-transform group-hover:-rotate-90 group-hover:text-sky-400" />
                          </div>
                          <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-slate-400">
                            {c.clinicalNotes}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {parseJsonArray(c.tags).slice(0, 4).map((t) => (
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
                  Cohort insights
                </CardTitle>
                <CardDescription>
                  Derived from every assigned case in your workspace (updates when you refresh or change the queue).
                </CardDescription>
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
        <SheetContent className="overflow-y-auto p-0">
          {selected ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-white/10 bg-gradient-to-br from-sky-500/15 via-transparent to-indigo-500/10 px-6 py-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-300/90">
                  Patient case detail
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selected.patientName}</h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant={riskBadge(selected.riskLevel)}>{selected.riskLevel} risk</Badge>
                  <span className="rounded-full bg-black/30 px-3 py-1 text-sm tabular-nums text-slate-200 ring-1 ring-white/10">
                    Score {selected.riskScore}/100
                  </span>
                  <span className="text-sm text-slate-400">Age {selected.age}</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-6 px-6 py-6">
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Clinical notes
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-slate-200">
                    {selected.clinicalNotes}
                  </p>
                </section>
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Extracted signals
                  </h3>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {parseJsonArray(selected.signals).map((s) => (
                      <li
                        key={s}
                        className="rounded-xl border border-sky-400/25 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-100"
                      >
                        {s}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    Explanation
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{selected.explanation}</p>
                </section>
                <Separator />
                <section className="grid gap-2 text-sm text-slate-400">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Created</span>
                    <span className="text-right text-slate-200">
                      {new Date(selected.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Assigned clinician</span>
                    <span className="text-right text-slate-200">
                      {selected.assignedClinician || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Case owner</span>
                    <span className="text-right text-xs text-slate-300">
                      {user?.primaryEmailAddress?.emailAddress ?? user?.username ?? selected.clerkUserId}
                    </span>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
