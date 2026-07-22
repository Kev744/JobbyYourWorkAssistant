import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '@/generated/prisma/client';
import { getDatabaseUrl } from '@/lib/env';

type PrismaGlobal = typeof globalThis & {
  matchingCvPrisma?: PrismaClient;
  matchingCvPgPool?: Pool;
};

const globalForPrisma = globalThis as PrismaGlobal;

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient() as unknown as Record<PropertyKey, unknown>;
    return client[property];
  },
});

export function getPrismaClient(): PrismaClient {
  if (globalForPrisma.matchingCvPrisma) {
    return globalForPrisma.matchingCvPrisma;
  }

  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL or POSTGRES_URL is required.');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: readPositiveInteger(process.env.DATABASE_POOL_MAX, 5),
    idleTimeoutMillis: readPositiveInteger(process.env.DATABASE_POOL_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: readPositiveInteger(process.env.DATABASE_POOL_CONNECT_TIMEOUT_MS, 5_000),
  });
  pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL connection-pool error.', error);
  });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  // Reuse one client and connection pool for the lifetime of this server process.
  // Recreating these objects on every request is especially expensive with the
  // local PostgreSQL adapter and slows down every server-rendered page.
  globalForPrisma.matchingCvPgPool = pool;
  globalForPrisma.matchingCvPrisma = client;

  return client;
}
