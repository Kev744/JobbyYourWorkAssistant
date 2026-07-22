export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

export function getLocalStorageDir(): string {
  return process.env.LOCAL_STORAGE_DIR || '.data/storage';
}

export function getAuthTokenSecret(): string {
  return (
    process.env.AUTH_JWT_SECRET ||
    process.env.APP_JWT_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'dev-jwt-secret'
  );
}
