# Patient RiskCalc — Next.js app

See the repository **[README.md](../README.md)** for architecture, Turso setup, and security notes.

Quick start:

```bash
cp .env.example .env.local
# Clerk keys + DATABASE_URL (libsql://…) + TURSO_AUTH_TOKEN + optional GROQ_API_KEY / Gemini / OpenAI

cp .env.local .env   # prisma generate / npm run db:seed read web/.env
npm install
npm run dev
```

Patient cases are stored only on **Turso**. Before first use run **`npm run db:apply-turso`** (uses **`web/.env.local`**).
