/**
 * Applies prisma/turso-init.sql to your Turso database.
 * From web/: npm run db:apply-turso
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { createClient } from "@libsql/client";
import { config } from "dotenv";

const root = process.cwd();
config({ path: resolve(root, ".env.local") });
config({ path: resolve(root, ".env") });

const url =
  process.env.TURSO_DATABASE_URL?.trim() ||
  (process.env.DATABASE_URL?.trim().startsWith("libsql://") ? process.env.DATABASE_URL.trim() : "");
const token = process.env.TURSO_AUTH_TOKEN?.trim();

if (!url || !token) {
  console.error(
    "Missing Turso credentials. Set TURSO_AUTH_TOKEN and TURSO_DATABASE_URL or DATABASE_URL=libsql://… in web/.env.local"
  );
  process.exit(1);
}

const sqlPath = resolve(root, "prisma/turso-init.sql");
const sql = readFileSync(sqlPath, "utf8");

const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.split("\n").every((line) => line.trim().startsWith("--")));

const client = createClient({ url, authToken: token });

async function main() {
  for (const stmt of statements) {
    await client.execute(stmt);
  }
  console.log("Turso schema applied:", sqlPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
