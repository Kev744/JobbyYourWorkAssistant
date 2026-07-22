import { createLocalDatabaseClient } from '@/lib/db/local-client';

export async function createServerDbClient() {
  return createLocalDatabaseClient();
}
