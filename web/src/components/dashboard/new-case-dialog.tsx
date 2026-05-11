"use client";

import { useRef, useState } from "react";
import { FileText, FileUp, Loader2, Sparkles, Upload } from "lucide-react";
import type { PatientCase } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CLIENT_INGEST_MAX_BYTES, extractDocumentInBrowser } from "@/lib/client-ingestion/extract-document-client";
import { cn } from "@/lib/utils";

type Tab = "paste" | "upload";

export function NewCaseDialog({
  trigger,
  onCaseCreated,
  onError,
}: {
  trigger: React.ReactNode;
  onCaseCreated: (c: PatientCase) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("paste");
  const [saving, setSaving] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [ingestPhase, setIngestPhase] = useState<string | null>(null);
  const [ingestNotice, setIngestNotice] = useState<string | null>(null);
  const [lastFileName, setLastFileName] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    patientName: "",
    age: "",
    clinicalNotes: "",
    rawDocumentText: "",
    ocrText: "" as string | null,
    ocrConfidence: null as number | null,
    inputSource: "paste" as "paste" | "image" | "pdf",
    tags: "",
    assignedClinician: "",
  });

  function resetForm() {
    setForm({
      patientName: "",
      age: "",
      clinicalNotes: "",
      rawDocumentText: "",
      ocrText: null,
      ocrConfidence: null,
      inputSource: "paste",
      tags: "",
      assignedClinician: "",
    });
    setTab("paste");
    setIngestNotice(null);
    setLastFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFileSelected(file: File | null) {
    if (!file) return;
    setLastFileName(file.name);
    setIngesting(true);
    setIngestPhase(null);
    setIngestNotice(null);
    onError("");
    try {
      const body = await extractDocumentInBrowser(file, {
        onPhase: (label) => setIngestPhase(label),
        onOcrProgress: (p) => {
          if (p.status === "recognizing text") {
            setIngestPhase(`OCR: ${p.status} (${Math.round(p.progress * 100)}%)`);
          } else {
            setIngestPhase(`OCR: ${p.status}`);
          }
        },
        onPdfPage: ({ page, total }) => setIngestPhase(`PDF: extracting text page ${page} / ${total}`),
      });
      const extracted = String(body.extractedText ?? "").trim();
      const conf = typeof body.ocrConfidence === "number" ? body.ocrConfidence : null;
      const warnings: string[] = Array.isArray(body.warnings) ? body.warnings.map(String) : [];
      setForm((f) => ({
        ...f,
        clinicalNotes: extracted || f.clinicalNotes,
        rawDocumentText: extracted,
        ocrText: extracted || null,
        ocrConfidence: conf,
        inputSource: body.inputSource,
      }));
      if (warnings.length) setIngestNotice(warnings.join(" "));
    } catch (e) {
      setLastFileName(null);
      onError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setIngesting(false);
      setIngestPhase(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const tags =
        form.tags.trim() === ""
          ? []
          : form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
      const rawDocumentText = (form.rawDocumentText || form.clinicalNotes).trim();
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: form.patientName.trim(),
          age: Number(form.age),
          clinicalNotes: form.clinicalNotes.trim(),
          rawDocumentText,
          ocrText: form.ocrText,
          ocrConfidence: form.ocrConfidence,
          inputSource: form.inputSource,
          tags,
          assignedClinician: form.assignedClinician.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not create care case");
      setOpen(false);
      resetForm();
      const created = body.case as PatientCase;
      if (created) onCaseCreated(created);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 sm:max-w-xl">
        <DialogTitle>New patient case</DialogTitle>
        <DialogDescription>
          Paste text, or upload a PDF or image. Text extraction runs in the browser; save sends the note to the server.
        </DialogDescription>

        <div className="mt-3 flex rounded-xl border border-white/10 bg-black/20 p-1 text-sm">
          <button
            type="button"
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 font-medium transition-colors",
              tab === "paste" ? "bg-white/[0.08] text-white ring-1 ring-white/12" : "text-slate-500 hover:text-slate-200"
            )}
            onClick={() => {
              setTab("paste");
              setIngestNotice(null);
            }}
          >
            <FileText className="h-4 w-4" />
            Paste text
          </button>
          <button
            type="button"
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 font-medium transition-colors",
              tab === "upload" ? "bg-white/[0.08] text-white ring-1 ring-white/12" : "text-slate-500 hover:text-slate-200"
            )}
            onClick={() => {
              setTab("upload");
              setIngestNotice(null);
            }}
          >
            <Upload className="h-4 w-4" />
            Upload file
          </button>
        </div>

        <form className="mt-4 flex flex-col gap-4" onSubmit={createCase}>
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

          {tab === "paste" ? (
            <div className="space-y-2">
              <Label htmlFor="notes">Clinical note text</Label>
              <Textarea
                id="notes"
                required
                className="min-h-[160px]"
                placeholder="Progress note, phone call, handoff…"
                value={form.clinicalNotes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    clinicalNotes: e.target.value,
                    rawDocumentText: e.target.value,
                    inputSource: "paste",
                    ocrText: null,
                    ocrConfidence: null,
                  }))
                }
              />
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 ring-1 ring-sky-500/25">
                  <FileUp className="h-4 w-4 text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Attach a document</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    PDF (text layer) or image. Parsed locally; only text is sent when you save. Max{" "}
                    {CLIENT_INGEST_MAX_BYTES / 1024 / 1024} MB.
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "relative flex min-h-[11rem] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                  dropActive
                    ? "border-sky-400/50 bg-sky-500/10"
                    : "border-white/12 bg-black/20 hover:border-sky-500/35 hover:bg-white/[0.04]",
                  ingesting && "pointer-events-none cursor-wait opacity-60"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  aria-label="Choose PDF or image file"
                  className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp"
                  disabled={ingesting}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (!ingesting) setDropActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    const next = e.relatedTarget as Node | null;
                    if (!next || !e.currentTarget.contains(next)) setDropActive(false);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f) void onFileSelected(f);
                  }}
                />
                <div className="pointer-events-none relative z-10 flex flex-col items-center gap-2">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
                    <Upload className="h-5 w-5 text-slate-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-100">Drop a file here or click this area</p>
                    <p className="mt-1 text-xs text-slate-500">PNG · JPEG · WebP · PDF · max 6 MB</p>
                  </div>
                  {lastFileName ? (
                    <span className="mt-1 max-w-full truncate rounded-md bg-black/40 px-2.5 py-1 font-mono text-[11px] text-sky-200/90 ring-1 ring-white/10">
                      {lastFileName}
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="pointer-events-auto relative z-30 mt-3 rounded-lg"
                  disabled={ingesting}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse files
                </Button>
              </div>

              {ingesting ? (
                <div className="flex flex-col gap-1 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                    <span>{ingestPhase ?? "Preparing extraction…"}</span>
                  </div>
                </div>
              ) : null}
              {ingestNotice && !ingesting ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                  {ingestNotice}
                </p>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="ocrPreview">Extracted text (editable)</Label>
                <Textarea
                  id="ocrPreview"
                  required
                  className="min-h-[140px] font-mono text-xs"
                  placeholder="Upload a file to populate this field, then edit if OCR missed words."
                  value={form.clinicalNotes}
                  onChange={(e) => setForm((f) => ({ ...f, clinicalNotes: e.target.value }))}
                />
              </div>
              {form.ocrConfidence != null ? (
                <p className="text-xs text-slate-500">
                  OCR confidence (heuristic):{" "}
                  <span className="font-mono text-slate-300">{(form.ocrConfidence * 100).toFixed(0)}%</span>
                </p>
              ) : null}
            </div>
          )}

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

          <Button type="submit" disabled={saving || ingesting} className="w-full rounded-xl">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running extraction & risk model…
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
  );
}
