import { PrismaClient } from '@prisma/client';

// Next's dev server re-evaluates modules on every edit; without this the
// process accumulates connection pools until Postgres refuses new ones.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
