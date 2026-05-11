import path from "path";
import { fileURLToPath } from "url";

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env from repo root, then web/ (web wins). Ensures Turso keys in the repo root are visible at runtime.
loadEnvConfig(path.join(__dirname, ".."));
loadEnvConfig(__dirname);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client"],
  },
  webpack: (config, { isServer }) => {
    // pdfjs-dist: drop optional canvas binding in the client bundle.
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },
};

export default nextConfig;
