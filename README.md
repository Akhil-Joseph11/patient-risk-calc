# Patient RiskCalc

**Patient RiskCalc** is a clinician-facing demo for triaging **patient cases** from unstructured **clinical notes**: paste or browser-side PDF/image text extraction, **rules-first extraction** with evidence phrases, a **FHIR-shaped bundle**, and **risk scoring**. **Guest mode** uses an empty queue until you add cases or choose **Load samples**; **signed-in** users (Clerk) persist rows on Turso (`clerkUserId`).

## Architecture

| Layer | Role |
|-------|------|
| **`web/`** — Next.js 14 (App Router) | **Guest-first** dashboard (optional Clerk). **Turso (libSQL)** via Prisma + driver adapter. Cases scoped by **`clerkUserId`** or **`guestSessionId`** cookie. **Ingestion**: PDF text + image OCR run **in the browser** (`pdfjs-dist`, `tesseract.js` via dynamic import); **`POST /api/cases`** accepts JSON text only (Vercel-friendly, no server binary pipeline for the demo path). **Pipeline**: rules extraction + FHIR-shaped bundle + risk (`web/src/lib/pipeline/*`, `web/src/lib/healthcare/*`); optional LLM blend (Groq → Gemini → OpenAI) in `web/src/lib/analysis/analyze-notes.ts`. |

## How auth works

1. Create a Clerk application at [Clerk Dashboard](https://dashboard.clerk.com/).
2. Copy **`web/.env.example`** → **`web/.env.local`** and fill Clerk keys plus **Turso** (`DATABASE_URL`, **`TURSO_AUTH_TOKEN`**—see Database section). Add optional LLM keys for Groq/Gemini/OpenAI on the **web** app env (server-only—never `NEXT_PUBLIC_` for API keys).
3. **Middleware** (`web/src/middleware.ts`) runs Clerk for optional auth; **`/dashboard` is not gated** so guests can use the app immediately.
4. **API routes** (`/api/cases/*`) scope rows by **Clerk `userId`** when present, otherwise by **guest session cookie**. No 401 for browsing the guest queue.

Sign-in/up components redirect to **`/dashboard`** after authentication.

## Case scoping (security model)

- **Signed in:** each row has **`clerkUserId`**; APIs filter `WHERE clerkUserId = currentUser`.
- **Guest:** rows use **`guestSessionId`** (httpOnly cookie); another browser session cannot read them unless the cookie is shared.
- **GET `/api/cases/[id]`** enforces the same owner filter.

There is **no** shared global queue across different Clerk users or unrelated guest cookies.

## Risk scoring

Analysis runs **inside Next.js** (`web/src/lib/analysis/analyze-notes.ts`) when creating cases (`POST /api/cases`, seed-demo).

1. **Groq** when **`GROQ_API_KEY`** is set (OpenAI-compatible API; default model `llama-3.3-70b-versatile`).
2. Else **Gemini** when **`GEMINI_API_KEY`** or **`GOOGLE_API_KEY`** is set (default model id `gemini-flash-latest`, overridable via **`GEMINI_MODEL`**).
3. Else **OpenAI** when **`OPENAI_API_KEY`** is set (default **`OPENAI_MODEL`** `gpt-4o-mini`).
4. Else **deterministic keyword/rules** (always available).

Invalid Groq JSON / missing `risk_score` falls back to rules for that request only; other providers fall through the cascade on errors.

**Diagnostics:** **`GET /api/health/analysis`** (no auth) reports which tier would run first.

Configure keys in **`web/.env.local`** (see **`web/.env.example`**).

## Database (Turso only)

Patient case data is stored only on **Turso** (remote libSQL). **`DATABASE_URL=file:…` is not supported** in the app.

Set in **`web/.env.local`** (or **`web/.env`**). Next also loads **`HealthLeap/.env`** from the repo root via **`next.config.mjs`** so Turso keys one level up are picked up. **Restart `npm run dev`** after changing env. For **`npm run db:seed`**, use **`web/.env`** or export vars in the shell (Prisma does not read `.env.local` by default).

| Variable | Purpose |
|----------|---------|
| **`DATABASE_URL`** | Your **`libsql://…`** URL from Turso (required for `prisma/schema.prisma` and should match the DB you use at runtime). |
| **`TURSO_DATABASE_URL`** | Optional; if set, used as the libSQL connection URL (otherwise **`DATABASE_URL`** when it is **`libsql://`**). |
| **`TURSO_AUTH_TOKEN`** | Required — Turso CLI: `turso db tokens create` for your database name. |

**Create tables on a new Turso database** (required once per empty DB):

```bash
cd web
npm run db:apply-turso
```

This reads **`web/.env.local`** and runs **`prisma/turso-init.sql`** (idempotent). Alternatively: **`npm run db:print-schema-sql`** and paste/run that SQL in the Turso dashboard.

If you see **`no such table: main.PatientCase`** or **`SQLITE_UNKNOWN`**, run **`npm run db:apply-turso`** again after confirming Turso env vars.

## Run locally

```bash
cd web
cp .env.example .env.local
# Clerk + Turso + optional GROQ_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY

cp .env.local .env   # same vars for prisma generate / db:seed
npm install
npm run dev
```

Open **http://localhost:3000** → **Continue as guest** or sign in → **Dashboard**.

**Ingestion in dev:** PDF text and image OCR run in the **browser** (see `web/src/lib/client-ingestion/`). Saving a case sends **JSON** to **`POST /api/cases`**; the server runs extraction and persistence only.

**Schema changes:** after pulling updates, from **`web/`** run **`npm run db:push`** (syncs missing `PatientCase` columns on Turso via `libsql://`). For an empty DB you can still use **`npm run db:apply-turso`**. Prisma CLI `db push` alone does not apply to remote Turso URLs with `provider = "sqlite"` — the repo script handles that.

### Demo seed data

- **Load samples** on an empty workspace (**`POST /api/cases/seed-demo`**), or
- **`npm run db:seed`** with **`SEED_CLERK_USER_ID`** set (and Turso in **`web/.env`**).

## Tradeoffs

- **Turso + Prisma libSQL adapter**: no on-disk case DB in the app; schema changes via SQL from **`db:print-schema-sql`** + apply on Turso.
- **Server-side LLM calls**: keys stay on the host (e.g. Vercel env); no separate analysis microservice.
- **Browser OCR / PDF**: keeps serverless functions small; Tesseract and PDF.js workers load from CDNs, so offline or strict CSP environments may need adjustment.
- **Demo-only**: sample notes; not for real PHI or clinical decisions.

## Deploy on Vercel (GitHub)

The Next.js app is a normal **Next.js 14** deploy: connect the repo, point Vercel at the **`web/`** folder, set env vars, push to `main` (or enable Preview for PRs).

1. **GitHub → Vercel:** New Project → Import repo → **Root Directory:** `web` (monorepo).
2. **Build:** Default `npm run build` (`prisma generate && next build`) is correct; `postinstall` also runs `prisma generate`.
3. **Runtime:** API routes use the **Node.js** runtime (default); Prisma + Turso libSQL client work on Vercel. **`schema.prisma`** includes **`binaryTargets`** for **`rhel-openssl-3.0.x`** so the query engine matches Vercel’s Linux hosts after **`npm run build`**.
4. **Document OCR / PDF:** no extra Vercel config — workers load from CDNs; parsing stays off the serverless request path until the user saves text.
5. **Analysis:** add **`GROQ_API_KEY`** (and/or Gemini/OpenAI keys) to Vercel env for LLM-backed scoring. Without them, the app uses the deterministic rules engine only.

### Environment variables on Vercel

Set these in **Vercel → Project → Settings → Environment Variables** (at minimum for **Production**; repeat for **Preview** if you want PR previews to work end-to-end).

| Variable | Required | Notes |
|----------|----------|--------|
| **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** | Yes | On **`*.vercel.app`**, use Clerk **Development** keys (**`pk_test_…`**). **`pk_live_…`** only with a **custom domain** wired in Clerk ([Clerk on Vercel](https://clerk.com/docs/deployments/deploy-to-vercel), [instances](https://clerk.com/docs/guides/development/managing-environments)). |
| **`CLERK_SECRET_KEY`** | Yes | Must match the same Clerk instance as the publishable key (**`sk_test_…`** or **`sk_live_…`**). Never expose client-side. |
| **`NEXT_PUBLIC_CLERK_SIGN_IN_URL`** | No | Defaults work; set to **`/sign-in`** if sign-in routes 404 in production. |
| **`NEXT_PUBLIC_CLERK_SIGN_UP_URL`** | No | Set to **`/sign-up`** if needed. |
| **`DATABASE_URL`** | Yes | Turso **`libsql://…`** URL (same DB you use locally). |
| **`TURSO_AUTH_TOKEN`** | Yes | DB auth token from Turso CLI / dashboard. |
| **`TURSO_DATABASE_URL`** | No | Set only if you want the adapter URL separate from `DATABASE_URL`. |
| **`LIBSQL_AUTH_TOKEN`** | No | Alias Turso reads in some setups; app prefers **`TURSO_AUTH_TOKEN`**. |
| **`GROQ_API_KEY`** | No | Groq Cloud API key for primary LLM path (server-only). |
| **`GROQ_MODEL`** | No | Defaults to **`llama-3.3-70b-versatile`**. |
| **`GROQ_API_BASE`** | No | Defaults to Groq OpenAI-compatible base URL. |
| **`GEMINI_API_KEY`** / **`GOOGLE_API_KEY`** | No | For Gemini path when Groq is absent or fails. |
| **`GEMINI_MODEL`** | No | Defaults to **`gemini-flash-latest`**. |
| **`OPENAI_API_KEY`** | No | OpenAI path when earlier tiers are unavailable. |
| **`OPENAI_MODEL`** | No | Defaults to **`gpt-4o-mini`**. |

After deploy: in **Clerk Dashboard → Configure → Paths**, ensure sign-in/sign-up paths match **`/sign-in`** and **`/sign-up`**. Under **Domains**, allow your deployment origin (e.g. **`https://your-app.vercel.app`**) if Clerk prompts for allowed origins / redirects.

### Troubleshooting: 404 or “code not found” after deploy

1. **Root Directory** must be **`web`** (otherwise the deployment is not a valid Next app).
2. **Clerk keys:** If the site is on **`*.vercel.app`**, use **Development** instance keys (**`pk_test_` / `sk_test_`**). Using **Production** keys without a Clerk production domain often breaks auth and can surface as 404s or failed Clerk requests ([preview + `vercel.app`](https://clerk.com/docs/guides/development/managing-environments#preview-environments-2)).
3. Redeploy after changing environment variables.

Ensure your Turso database has schema applied once (**`npm run db:apply-turso`** against prod credentials locally, or run **`web/prisma/turso-init.sql`** on Turso).

## Favicon

`web/public/favicon.svg` — referenced from root layout metadata.
