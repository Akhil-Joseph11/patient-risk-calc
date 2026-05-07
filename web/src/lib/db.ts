import type { PrismaClient } from "@prisma/client";

import { createPrismaClient } from "@/lib/prisma-client-factory";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/** Lazy singleton — avoids requiring Turso env during `next build` static analysis. */
export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}
