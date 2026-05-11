# Patient RiskCalc (`web/`)

Guest-first: notes in, rules-based extraction and optional LLM scoring, FHIR-shaped bundle in the drawer, Clerk optional for your own queue on Turso.

## What this demo does

1. **Landing** — Continue as **guest** (instant) or **sign in** (persisted cases on Turso).
2. **Ingestion** — Paste text, or upload a **PDF** (embedded text via **PDF.js** in the browser) / **image** (**Tesseract.js** in the browser, dynamically loaded). Extracted text is shown and editable before save. The server receives **JSON text** on `POST /api/cases`, not raw files, on the default path (Vercel-friendly).
3. **Extraction** — Rule-based patterns produce structured **signals with evidence phrases** (and optional character spans). **No paid API** is required for this step.
4. **FHIR-inspired model** — Internal `Bundle` with `Patient`, `Encounter`, `Observation`, `Condition`, `MedicationStatement`, `ClinicalNote`, and `RiskAssessment`-style resources (see `src/lib/healthcare/`).
5. **Risk score** — Keyword **rules engine** always runs; if `GROQ_API_KEY`, `GEMINI_API_KEY` / `GOOGLE_API_KEY`, or `OPENAI_API_KEY` is set, the server **blends** LLM JSON with the rules score for the demo.
6. **Detail drawer** — Highlights on the note, signal sources, pipeline trace, review state, collapsible structured bundle.

## Guest mode

- **Cookie** `prc_guest_sid` (httpOnly) scopes anonymous rows in `PatientCase.guestSessionId`.
- **Guests** get an empty case list on first visit; **`POST /api/cases/seed-demo`** (Load samples) or a manual case uses `src/lib/demo-cases.ts` for optional seed rows.
- **Sign in** keeps the existing Clerk flow; new cases use `clerkUserId` and ignore the guest queue (no auto-merge in this iteration).

## Browser vs server (Vercel)

| Where | What runs |
|-------|-----------|
| **Browser** | File pick → **PDF.js** and/or **Tesseract** (`src/lib/client-ingestion/*`). Workers load from CDNs; progress in the new-case dialog. |
| **Server** (`POST /api/cases`) | Receives `clinicalNotes`, `rawDocumentText`, optional `ocrText` / `ocrConfidence` / `inputSource`; runs **`fullClinicalPipeline`**, persists to Turso. No binary ingest route for the core demo. |

## OCR and PDF text

- **Images** — `tesseract.js` via **dynamic `import()`**; English; low mean confidence surfaces a non-blocking notice in the UI.
- **PDFs** — `pdfjs-dist` via **dynamic `import()`**; if the PDF has almost no text layer (common for scan-only PDFs), the UI suggests image OCR or paste.
- **Size limit** — `CLIENT_INGEST_MAX_BYTES` in `src/lib/client-ingestion/extract-document-client.ts` (default 6 MB).

## FHIR-inspired model

Not a certified FHIR server. Types live in `src/lib/healthcare/fhir-inspired-types.ts`; assembly in `build-clinical-bundle.ts`. The goal is **readable healthcare-shaped JSON** for interviews and demos.

## Scoring

- **Rules** — `src/lib/analysis/rules.ts` (weights + negation handling, e.g. “denies fever”).
- **Optional LLM** — Same cascade as before (`analyze-notes.ts`); pipeline blends scores when a provider is configured (`src/lib/pipeline/full-clinical-pipeline.ts`).
- **Confidence** — `analysisConfidence` on each row is a **demo heuristic** from signal OCR/extraction strength, not clinical calibration.

## Tests

```bash
npm test
```

Covers extraction edge cases and the full pipeline with LLM keys stripped.

## Run locally

```bash
cp .env.example .env.local
# Clerk (optional for guest-only), DATABASE_URL (libsql://…), TURSO_AUTH_TOKEN, optional LLM keys

cp .env.local .env   # prisma / seed
npm install
npm run db:apply-turso   # empty Turso DB — see repo README
npm run dev
```

Open **http://localhost:3000** → **Continue as guest** → **Dashboard**.

**Schema drift** (e.g. `no such column: guestSessionId`, or **`NOT NULL constraint failed: PatientCase.clerkUserId`** in guest mode): from `web/`, run **`npm run db:push`**. With **Turso** (`libsql://`), this runs **`scripts/sync-patient-case-columns.ts`**: it adds missing columns, and if `clerkUserId` is still legacy-`NOT NULL`, it **rebuilds** `PatientCase` so `clerkUserId` can be `NULL` for guests. You can also run **`npm run db:sync-columns`** directly.

See the repository **[README.md](../README.md)** for Turso setup, security notes, Vercel env vars, and architecture overview.
