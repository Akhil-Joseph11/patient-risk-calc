# Patient RiskCalc — `web/` package

This directory is the Next.js application. For architecture, user flows, Turso setup, and deployment, read the **[repository README](../README.md)** first; this file only scopes what lives here.

## Layout

- **`src/app/`** — Routes (`/`, `/dashboard`, Clerk sign-in/up), App Router API under `src/app/api/`.
- **`src/components/`** — UI, mostly dashboard case queue, detail sheet, new-case dialog, insights.
- **`src/lib/`** — Pipeline, analysis, extraction, healthcare bundle types, guest session, Prisma wiring, client-side OCR/PDF helpers.
- **`prisma/`** — Schema, Turso bootstrap SQL, seed script (`SEED_CLERK_USER_ID` for signed-in seed only).
- **`scripts/`** — `db-push.ts` / `sync-patient-case-columns.ts` for Turso column drift.

## Commands

| Command | Use |
|---------|-----|
| `npm run dev` | Local dev server |
| `npm run build` | Production build (`prisma generate` + `next build`) |
| `npm test` | Vitest |
| `npm run db:apply-turso` | Apply `turso-init.sql` to an empty remote DB |
| `npm run db:push` | `db-push.ts`: Turso → column sync script; `file:` SQLite → `prisma db push` |
| `npm run db:sync-columns` | Run **`scripts/sync-patient-case-columns.ts`** directly |

Copy **`web/.env.example`** to **`.env.local`** for local work; duplicate into **`.env`** if you run Prisma CLI or seed against the same Turso instance (Prisma does not read `.env.local` by default).
