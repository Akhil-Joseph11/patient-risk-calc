/**
 * Idempotent schema sync for PatientCase on Turso (libsql://).
 * 1) Adds any missing columns via ALTER.
 * 2) If clerkUserId is still NOT NULL (legacy table), rebuilds the table so guest rows can use NULL clerkUserId.
 *
 * From web/: npm run db:sync-columns  (also invoked by npm run db:push for libsql URLs)
 */
import { resolve } from "node:path";

import { createClient } from "@libsql/client";
import { config } from "dotenv";

const root = process.cwd();
config({ path: resolve(root, ".env.local") });
config({ path: resolve(root, ".env") });
config({ path: resolve(root, "..", ".env") });

const url =
  process.env.TURSO_DATABASE_URL?.trim() ||
  (process.env.DATABASE_URL?.trim().startsWith("libsql://") ? process.env.DATABASE_URL.trim() : "");
const token = process.env.TURSO_AUTH_TOKEN?.trim();

if (!url || !token) {
  console.error("Missing Turso URL/token. See web/.env.example");
  process.exit(1);
}

function columnNames(res: { rows: unknown[] }): Set<string> {
  const out = new Set<string>();
  for (const row of res.rows) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const n = (row as { name?: unknown }).name;
      if (typeof n === "string") out.add(n);
    } else if (Array.isArray(row) && row.length > 1) {
      out.add(String(row[1]));
    }
  }
  return out;
}

function clerkUserIdIsNotNull(res: { rows: unknown[] }): boolean {
  for (const row of res.rows) {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const o = row as { name?: unknown; notnull?: unknown };
      if (o.name === "clerkUserId" && Number(o.notnull) === 1) return true;
    } else if (Array.isArray(row) && row[1] === "clerkUserId" && Number(row[3]) === 1) {
      return true;
    }
  }
  return false;
}

/** Matches prisma/turso-init.sql — clerkUserId nullable for guest mode. */
const CREATE_PATIENT_CASE = `
CREATE TABLE "PatientCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkUserId" TEXT,
    "guestSessionId" TEXT,
    "patientName" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "clinicalNotes" TEXT NOT NULL,
    "rawDocumentText" TEXT NOT NULL DEFAULT '',
    "ocrText" TEXT,
    "ocrConfidence" REAL,
    "inputSource" TEXT NOT NULL DEFAULT 'paste',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "assignedClinician" TEXT,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "signals" TEXT NOT NULL DEFAULT '[]',
    "signalEvidence" TEXT NOT NULL DEFAULT '[]',
    "structuredRecord" TEXT NOT NULL DEFAULT '{}',
    "explanation" TEXT NOT NULL,
    "analysisConfidence" INTEGER NOT NULL DEFAULT 72,
    "reviewState" TEXT NOT NULL DEFAULT 'medium_confidence',
    "pipelineTrace" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)
`.trim();

function col(have: Set<string>, name: string, fallbackSql: string): string {
  return have.has(name) ? `"${name}"` : fallbackSql;
}

function buildInsertFromLegacy(have: Set<string>): string {
  const rawExpr = have.has("rawDocumentText") ? `"rawDocumentText"` : `"clinicalNotes"`;

  const selectList = [
    col(have, "id", "NULL"),
    col(have, "clerkUserId", "NULL"),
    col(have, "guestSessionId", "NULL"),
    col(have, "patientName", "''"),
    col(have, "age", "0"),
    col(have, "clinicalNotes", "''"),
    rawExpr,
    col(have, "ocrText", "NULL"),
    col(have, "ocrConfidence", "NULL"),
    col(have, "inputSource", "'paste'"),
    col(have, "tags", "'[]'"),
    col(have, "assignedClinician", "NULL"),
    col(have, "riskScore", "0"),
    col(have, "riskLevel", "''"),
    col(have, "signals", "'[]'"),
    col(have, "signalEvidence", "'[]'"),
    col(have, "structuredRecord", "'{}'"),
    col(have, "explanation", "''"),
    col(have, "analysisConfidence", "72"),
    col(have, "reviewState", "'medium_confidence'"),
    col(have, "pipelineTrace", "'[]'"),
    col(have, "createdAt", "CURRENT_TIMESTAMP"),
  ].join(",\n  ");

  return `
INSERT INTO "PatientCase" (
  "id", "clerkUserId", "guestSessionId", "patientName", "age", "clinicalNotes",
  "rawDocumentText", "ocrText", "ocrConfidence", "inputSource", "tags", "assignedClinician",
  "riskScore", "riskLevel", "signals", "signalEvidence", "structuredRecord", "explanation",
  "analysisConfidence", "reviewState", "pipelineTrace", "createdAt"
)
SELECT
  ${selectList}
FROM "PatientCase_legacy"
`.trim();
}

const ADDS: { name: string; ddl: string }[] = [
  { name: "guestSessionId", ddl: `ALTER TABLE "PatientCase" ADD COLUMN "guestSessionId" TEXT` },
  { name: "rawDocumentText", ddl: `ALTER TABLE "PatientCase" ADD COLUMN "rawDocumentText" TEXT NOT NULL DEFAULT ''` },
  { name: "ocrText", ddl: `ALTER TABLE "PatientCase" ADD COLUMN "ocrText" TEXT` },
  { name: "ocrConfidence", ddl: `ALTER TABLE "PatientCase" ADD COLUMN "ocrConfidence" REAL` },
  { name: "inputSource", ddl: `ALTER TABLE "PatientCase" ADD COLUMN "inputSource" TEXT NOT NULL DEFAULT 'paste'` },
  { name: "signalEvidence", ddl: `ALTER TABLE "PatientCase" ADD COLUMN "signalEvidence" TEXT NOT NULL DEFAULT '[]'` },
  { name: "structuredRecord", ddl: `ALTER TABLE "PatientCase" ADD COLUMN "structuredRecord" TEXT NOT NULL DEFAULT '{}'` },
  { name: "analysisConfidence", ddl: `ALTER TABLE "PatientCase" ADD COLUMN "analysisConfidence" INTEGER NOT NULL DEFAULT 72` },
  { name: "reviewState", ddl: `ALTER TABLE "PatientCase" ADD COLUMN "reviewState" TEXT NOT NULL DEFAULT 'medium_confidence'` },
  { name: "pipelineTrace", ddl: `ALTER TABLE "PatientCase" ADD COLUMN "pipelineTrace" TEXT NOT NULL DEFAULT '[]'` },
];

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS "PatientCase_clerkUserId_idx" ON "PatientCase"("clerkUserId")`,
  `CREATE INDEX IF NOT EXISTS "PatientCase_guestSessionId_idx" ON "PatientCase"("guestSessionId")`,
  `CREATE INDEX IF NOT EXISTS "PatientCase_clerkUserId_riskScore_idx" ON "PatientCase"("clerkUserId", "riskScore")`,
];

async function rebuildPatientCaseForGuestMode(client: ReturnType<typeof createClient>) {
  console.log(
    '[PatientCase] Rebuilding table so "clerkUserId" can be NULL (required for guest mode). Copying rows to "PatientCase_legacy" → new table…'
  );
  await client.execute(`DROP TABLE IF EXISTS "PatientCase_legacy"`);
  await client.execute(`ALTER TABLE "PatientCase" RENAME TO "PatientCase_legacy"`);
  const legacyCols = columnNames(await client.execute(`PRAGMA table_info("PatientCase_legacy")`));

  await client.execute(CREATE_PATIENT_CASE);
  const insertSql = buildInsertFromLegacy(legacyCols);
  await client.execute(insertSql);
  await client.execute(`DROP TABLE "PatientCase_legacy"`);

  for (const idx of INDEXES) {
    await client.execute(idx);
  }
  console.log('[PatientCase] Rebuild complete; guest rows may use NULL "clerkUserId".');
}

async function main() {
  const client = createClient({ url, authToken: token });
  const res = await client.execute(`PRAGMA table_info("PatientCase")`);
  if (!res.rows.length) {
    console.error('No "PatientCase" table (or empty PRAGMA). Run: npm run db:apply-turso');
    process.exit(1);
  }
  let have = columnNames(res);

  for (const { name, ddl } of ADDS) {
    if (have.has(name)) continue;
    console.log("Applying:", ddl);
    await client.execute(ddl);
    have.add(name);
  }

  const res2 = await client.execute(`PRAGMA table_info("PatientCase")`);
  if (clerkUserIdIsNotNull(res2)) {
    await rebuildPatientCaseForGuestMode(client);
  } else {
    for (const idx of INDEXES) {
      await client.execute(idx);
    }
    console.log("PatientCase columns synced.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
