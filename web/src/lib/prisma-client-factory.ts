import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const defaultLog =
  process.env.NODE_ENV === "development"
    ? (["error", "warn"] as const)
    : (["error"] as const);

function tursoDatabaseUrl(): string | undefined {
  const explicit = process.env.TURSO_DATABASE_URL?.trim();
  if (explicit && explicit.startsWith("libsql://")) return explicit;
  const db = process.env.DATABASE_URL?.trim();
  if (db?.startsWith("libsql://")) return db;
  return undefined;
}

function tursoAuthToken(): string | undefined {
  const t =
    process.env.TURSO_AUTH_TOKEN?.trim() ||
    process.env.LIBSQL_AUTH_TOKEN?.trim();
  return t || undefined;
}

function explainTursoEnvError(): string {
  const url = tursoDatabaseUrl();
  const token = tursoAuthToken();
  const rawDb = process.env.DATABASE_URL?.trim() ?? "";

  const parts: string[] = [];
  if (!url) {
    parts.push(
      "No libsql:// URL found. Set TURSO_DATABASE_URL or DATABASE_URL to your Turso libsql URL (must start with libsql://)."
    );
    if (rawDb.startsWith("file:")) {
      parts.push(
        'DATABASE_URL is still file:… — replace it with libsql://… from `turso db show`, or put the libsql URL in TURSO_DATABASE_URL only.'
      );
    } else if (rawDb && !rawDb.startsWith("libsql://")) {
      parts.push(
        "DATABASE_URL is set but does not start with libsql:// (Turso requires the libsql:// form from the Turso dashboard or CLI)."
      );
    }
  }
  if (!token) {
    parts.push("TURSO_AUTH_TOKEN is missing or empty. Create a token with: turso db tokens create <database-name>");
  }
  parts.push("Env is loaded from web/.env.local, web/.env, and the repo root .env (see next.config.mjs). Restart the dev server after changing env files.");
  return parts.join(" ");
}

/**
 * Remote Turso (libSQL) only. No local file SQLite — case data is not stored in a local Prisma file DB.
 */
export function createPrismaClient(): PrismaClient {
  const tursoUrl = tursoDatabaseUrl();
  const tursoToken = tursoAuthToken();

  if (!tursoUrl || !tursoToken) {
    const detail = explainTursoEnvError();
    throw new Error(`Turso database is not configured. ${detail}`.trim());
  }

  const libsql = createClient({ url: tursoUrl, authToken: tursoToken });
  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({ adapter, log: [...defaultLog] });
}
