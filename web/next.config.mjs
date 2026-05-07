import path from "path";
import { fileURLToPath } from "url";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from repo root first, then web/ (web overrides). Turso keys are often placed in the
// wrong file (e.g. HealthLeap/.env instead of web/.env.local); this fixes missing process.env at runtime.
loadEnvConfig(path.join(__dirname, ".."));
loadEnvConfig(__dirname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
};

export default nextConfig;
