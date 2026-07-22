import { Prisma } from '@/generated/prisma/client';
import { getPrismaClient } from '@/lib/db/prisma';

const MAX_SERIALIZATION_RETRIES = 3;

/**
 * Runs a small write unit at PostgreSQL's serializable isolation level.
 *
 * PostgreSQL can reject a concurrent transaction at this level (P2034). Retrying
 * that specific, safe-to-retry outcome keeps sequence-style writes deterministic
 * without hiding validation or constraint errors.
 */
export async function withSerializableTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
    try {
      return await getPrismaClient().$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 2_000,
        timeout: 5_000,
      });
    } catch (error) {
      if (!hasPrismaErrorCode(error, 'P2034') || attempt === MAX_SERIALIZATION_RETRIES - 1) {
        throw error;
      }
    }
  }

  throw new Error('Unreachable transaction retry state.');
}

export function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
