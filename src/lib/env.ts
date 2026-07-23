type RuntimeEnvironment = 'development' | 'production';

/**
 * `test` intentionally uses the development configuration. Tests set explicit
 * process variables and must never select production credentials.
 */
export function getRuntimeEnvironment(): RuntimeEnvironment {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

function getEnvironmentValue(name: string): string {
  const environmentSuffix = getRuntimeEnvironment().toUpperCase();

  // Keep the unsuffixed value as a migration fallback for existing local and
  // Railway deployments. Environment-specific values always take precedence.
  return process.env[`${name}_${environmentSuffix}`] || process.env[name] || '';
}

export function getDatabaseUrl(): string {
  return getEnvironmentValue('DATABASE_URL') || getEnvironmentValue('POSTGRES_URL');
}

export function getOpenAiKey(): string {
  return getEnvironmentValue('OPENAI_KEY');
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
