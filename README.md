# Patient RiskCalc

Patient RiskCalc is a small Next.js application built around a single idea: take messy clinical note text, run a consistent extraction and scoring pass on the server, and show the result in a form that resembles how triage tools are reviewed in practice—risk level, short rationale, evidence tied back to the note, and a structured record you can inspect like a chart abstract. It is intended for evaluation and workflow exploration, not as a regulated clinical product.

The runnable code lives under **`web/`** (that folder is the deployable unit on Vercel).

---

## System shape

The app is **Next.js 14** with the App Router. The UI is server-rendered where it makes sense and uses client components for the dashboard, dialogs, and anything that touches the file APIs.

**Persistence** goes through **Prisma** to **Turso** (remote libSQL) in the usual deployment. There is no checked-in database file; **`DATABASE_URL`** is normally a **`libsql://…`** URL with a token. A local **`file:`** SQLite URL is still supported for experiments—**`npm run db:push`** runs **`prisma db push`** in that case instead of the Turso column-sync script.

**Clerk** handles sign-in when you want accounts. It is not required to open the dashboard. Middleware still runs Clerk so session helpers work on API routes, but the product is deliberately usable without creating an account first.

---

## User flow, end to end

### Landing and workspace

Someone lands on `/`. If they already have a Clerk session they go straight to `/dashboard`. Otherwise they can open the dashboard as a **guest**.

Guests do not get pre-filled cases. The first time the client calls **`GET /api/cases`**, the server may mint a new anonymous workspace id, set it on an **httpOnly** cookie (`prc_guest_sid`), and return an empty list (or whatever that guest has already saved). From there they either add their own case, or use **Load samples** to pull in a fixed set of seed rows from `web/src/lib/demo-cases.ts` via **`POST /api/cases/seed-demo`** when the workspace is still empty.

Signed-in users see only rows whose **`clerkUserId`** matches their Clerk id. Guests see only rows whose **`guestSessionId`** matches their cookie. Those two populations are not merged.

### Adding a case

The dashboard has a **New case** flow. The operator enters patient name and age, then either pastes note text or switches to **upload**.

**Paste** is straightforward: the text you type is what the server analyzes.

**Upload** is handled almost entirely in the browser. PDFs go through **pdf.js** (dynamic import, worker from a CDN). Images go through **Tesseract** the same way. The UI shows progress while that runs. The important part for hosting is that the server is not asked to accept a multipart upload and run OCR in a serverless function; instead the client sends **JSON** to **`POST /api/cases`** with `clinicalNotes`, optional `rawDocumentText`, optional `ocrText` / `ocrConfidence`, and `inputSource` (`paste` | `pdf` | `image`). That keeps the default path small and predictable on Vercel.

After extraction the user can edit the text before saving, which matters when OCR is imperfect.

### What happens when a case is saved

`POST /api/cases` validates the payload, resolves the owner (Clerk user or guest session), then calls **`persistAnalyzedCase`** in `web/src/lib/cases/persist-patient-case.ts`.

That helper runs **`runFullClinicalPipeline`** (`web/src/lib/pipeline/full-clinical-pipeline.ts`). In order:

1. **Signal extraction** — `extractClinicalSignals` in `web/src/lib/extraction/clinical-signals.ts` applies deterministic patterns to the canonical note and returns structured rows with labels, evidence phrases, and spans when the match allows it.

2. **Rules scoring** — `analyzeWithRules` / `rules.ts` produces a baseline integer score and human-readable signal labels from overlapping keyword logic (including simple negation handling where it matters, e.g. fever language).

3. **Optional remote scoring** — If any of Groq, Gemini, or OpenAI keys are present in the server environment, `analyzeNotes` tries providers in that order. On success the pipeline **blends** the rules score with the model’s numeric score and may take the model’s signal list and explanation text. If every configured path fails, the rules output stands alone. The stored field **`scoringMethod`** records whether enrichment ran.

4. **Bundle assembly** — `buildClinicalBundle` maps those signals into a **FHIR-inspired** JSON bundle (Patient, Encounter, ClinicalNote, observations, conditions, medication statements, risk assessment). This is not a certified FHIR server; the types live under `web/src/lib/healthcare/` and exist so the drawer can show something close to how structured data is usually grouped.

5. **Evidence enrichment** — `enrichSignalsForPersistence` tags each signal with where its evidence came from (rules path, document capture path, enrichment path) and aligns highlight spans to the raw document string the UI uses.

6. **Review state** — `deriveCaseReviewState` assigns a coarse review band from heuristics (documentation ambiguity, confidence, etc.). It is a product convenience, not a clinical validation layer.

7. **Pipeline trace** — `buildClinicalPipelineTrace` writes an ordered list of steps (input length, optional OCR modality, extraction count, bundle size, score band, explanation source) so the detail view can show how the row was produced without opening the code.

8. **Persist** — One Prisma `create` writes the row, including JSON columns for `signalEvidence`, `structuredRecord`, and `pipelineTrace`.

### Reading a case back

Opening a row loads **`GET /api/cases/[id]`** with the same owner filter. The sheet shows the pipeline trace first, then signals and evidence, labels, explanation, the highlighted note, optional OCR copy, the canonical note, and a collapsible JSON view of the bundle. Insights on the dashboard are simple aggregates over whatever cases are already loaded for that workspace.

---

## Where the important code sits

| Area | Path | Role |
|------|------|------|
| Case HTTP API | `web/src/app/api/cases/` | List, create, optional seed, single-case access |
| Guest cookie helpers | `web/src/lib/guest-session.ts` | Read/write `prc_guest_sid` |
| DB client | `web/src/lib/db.ts`, `web/src/lib/prisma-client-factory.ts` | Lazy Prisma + libSQL adapter |
| Pipeline orchestration | `web/src/lib/pipeline/full-clinical-pipeline.ts` | Extraction → score → bundle → enrich → review → trace |
| Trace strings | `web/src/lib/pipeline/clinical-trace.ts` | Step titles and copy for the drawer |
| Rules engine | `web/src/lib/analysis/rules.ts` | Patterns, weights, baseline explanation |
| Provider cascade | `web/src/lib/analysis/analyze-notes.ts` | Groq → Gemini → OpenAI → rules |
| System prompt | `web/src/lib/analysis/constants.ts` | Shared instruction block for JSON responses |
| Browser OCR/PDF | `web/src/lib/client-ingestion/` | Tesseract + pdf.js, size limits, MIME fallbacks |
| Dashboard UI | `web/src/components/dashboard/` | Queue, detail sheet, insights, new-case dialog |
| Schema | `web/prisma/schema.prisma` | `PatientCase` and indexes |

---

## Configuration and operations (short)

You need a Turso database and env vars as in **`web/.env.example`**: a **`libsql://…`** URL (often **`DATABASE_URL`**, or **`TURSO_DATABASE_URL`** with the same value) plus **`TURSO_AUTH_TOKEN`**. Clerk keys are required if you use sign-in; for guest-only local runs you can still point Prisma at Turso. Optional **`GROQ_API_KEY`**, **`GEMINI_API_KEY`** or **`GOOGLE_API_KEY`**, or **`OPENAI_API_KEY`** turn on the enrichment path described above.

`next.config.mjs` loads env from the **repository root** and then **`web/`**, so a Turso block in a parent `.env` is picked up during `next dev` and builds.

First-time schema on an empty Turso DB: from **`web/`**, **`npm run db:apply-turso`** applies **`prisma/turso-init.sql`** via **`scripts/apply-turso-schema.ts`**. If the remote DB predates a schema change, **`npm run db:push`** runs **`scripts/db-push.ts`**, which on `libsql://` URLs executes the idempotent **`scripts/sync-patient-case-columns.ts`** path (and uses **`prisma db push`** for local `file:` SQLite only).

**Deploy:** Vercel project root **`web`**, same env surface as production. Tesseract and pdf.js workers load from public CDNs in the browser; no extra Vercel config is required for that path.

**`GET /api/health/analysis`** returns which scoring tier would run first (booleans and model ids only—no secrets).

---

## Tradeoffs in the current system

These are deliberate or inherited limits of the stack as it exists today—not a roadmap.

- **Data lives in your Turso account.** There is no application-managed backup, retention policy, or encryption story beyond what Turso provides. The repo does not ship a production dataset.

- **Guest workspaces are cookie-bound.** The `prc_guest_sid` cookie is httpOnly and lasts about **180 days** (`guest-session.ts`). Clearing cookies or using another browser starts a new empty workspace. There is no in-app path to merge guest data into a Clerk account.

- **Clerk and guest data never mix.** Rows are filtered by `clerkUserId` or `guestSessionId`; the same person cannot see both sets in one view without manual database work.

- **Case rows are effectively append-only from the API.** You can list and fetch cases and create new ones; there is no supported HTTP path to edit note text, re-run the pipeline on an existing row, or delete a case through the app.

- **Insights are derived in the browser** from whatever cases `GET /api/cases` already returned. They are not a separate warehouse or time-series view; large queues are limited by that single fetch and client memory.

- **Upload path is browser-first.** PDF text uses **pdf.js** with the worker loaded from **unpkg**; image OCR uses **Tesseract** worker and WASM from **jsdelivr**. If those CDNs or the user’s network block those hosts, upload fails regardless of server health.

- **Hard cap on upload size:** **`CLIENT_INGEST_MAX_BYTES`** is **6 MB** (`extract-document-client.ts`). Larger files are rejected before extraction.

- **PDFs are text-layer extraction only.** If a PDF is mostly scans, pdf.js often yields little text; the UI warns and suggests an image upload or paste. There is no server-side raster OCR for PDFs.

- **Image OCR is English (`eng`) and runs entirely in the tab.** Quality depends on resolution, skew, and handwriting; low engine confidence surfaces a warning. CPU and battery cost sit on the client.

- **Server sees note text as JSON, not raw files.** That suits serverless limits and avoids multipart pipelines, but it means large payloads go through the request body and whatever body-size limits your host applies.

- **Scoring when LLM keys exist uses a fixed blend:** **55% rules, 45% model** on the numeric score (`full-clinical-pipeline.ts`). That weighting is a product choice, not a calibrated clinical model. If the model call throws, the pipeline **falls back to rules only** with no surfaced error to the end user.

- **Provider cascade** (`analyzeNotes`): **Groq → Gemini → OpenAI → rules**, but only when a stage **throws**. Groq’s client path can **return the rules engine** on malformed JSON instead of throwing, so Gemini/OpenAI keys may sit unused in the same request.

- **Third-party models process PHI you choose to submit.** Keys live in server environment variables; traffic goes to whichever providers you configure. There is no on-prem model option in this codebase.

- **Signal extraction is pattern-based** (`clinical-signals.ts`, `rules.ts`). It will miss paraphrases, structured feeds, and nuance that humans catch, and it can over-trigger on noisy prose.

- **“Review state” and pipeline trace are explanatory** (`review-state.ts`, trace builders). They do not replace human review, policy, or instrument validation.

- **FHIR-shaped bundles are for display and inspection** (`fhir-inspired-types.ts`). They are not emitted by a certified FHIR server and should not be treated as interoperable clinical records.

- **Demo samples are static** (`demo-cases.ts`). **Load samples** only applies when the workspace queue is empty (`seed-demo` route); it does not refresh or version those rows.

---

## Tests

From **`web/`**: **`npm test`** (Vitest). Extraction, enrichment, review heuristics, rules, and the full pipeline are covered with LLM keys stripped in CI-style runs.
