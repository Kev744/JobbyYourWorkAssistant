import { existsSync, readFileSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

loadEnvFile('.env');
loadEnvFile('.env.local');
loadEnvFile(`.env.${getRuntimeEnvironment()}`);
loadEnvFile(`.env.${getRuntimeEnvironment()}.local`);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});

function getRuntimeEnvironment(): 'development' | 'production' {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

function getEnvironmentValue(name: string): string {
  const environmentSuffix = getRuntimeEnvironment().toUpperCase();

  return process.env[`${name}_${environmentSuffix}`] || process.env[name] || '';
}

function getDatabaseUrl(): string {
  return getEnvironmentValue('DATABASE_URL') || getEnvironmentValue('POSTGRES_URL');
}

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim();
    process.env[key] ??= value;
  }
}
