/**
 * Syncs the live database with the current Prisma model.
 *
 * - **Turso (`libsql://`)**: Prisma CLI cannot `db push` against libsql URLs with `provider = "sqlite"`,
 *   so we run `scripts/sync-patient-case-columns.ts` (idempotent `ALTER TABLE` via `@libsql/client`).
 * - **Local file SQLite (`file:`)**: runs `prisma db push`.
 *
 * From web/: npm run db:push
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";

import { config } from "dotenv";

const root = process.cwd();
config({ path: resolve(root, ".env.local") });
config({ path: resolve(root, ".env") });
config({ path: resolve(root, "..", ".env") });

const dbUrl =
  process.env.TURSO_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  "";

const token = process.env.TURSO_AUTH_TOKEN?.trim();

if (dbUrl.startsWith("libsql://")) {
  if (!token) {
    console.error("TURSO_AUTH_TOKEN is required for libsql:// URLs. See web/.env.example.");
    process.exit(1);
  }
  console.log("Turso (libsql) detected — syncing PatientCase columns…");
  execSync("npx tsx scripts/sync-patient-case-columns.ts", {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
} else if (dbUrl.startsWith("file:")) {
  execSync("npx prisma db push --accept-data-loss", {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
} else {
  console.error(
    "No usable DATABASE_URL / TURSO_DATABASE_URL. Use libsql://… + TURSO_AUTH_TOKEN (Turso) or file:… (local SQLite)."
  );
  process.exit(1);
}
