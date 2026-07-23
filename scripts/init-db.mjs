import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

loadDotEnvLocal();

const databaseUrl = getDatabaseUrl();

if (!databaseUrl) {
  console.error('A PostgreSQL URL is required for the active NODE_ENV.');
  process.exit(1);
}

runPrisma(['generate']);
runPrisma(['migrate', 'deploy']);

function runPrisma(args) {
  const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', ...args], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function loadDotEnvLocal() {
  loadEnvFile('.env');
  loadEnvFile('.env.local');
  const environment = getRuntimeEnvironment();
  loadEnvFile(`.env.${environment}`);
  loadEnvFile(`.env.${environment}.local`);
}

function getRuntimeEnvironment() {
  return process.env.NODE_ENV === 'production' ? 'production' : 'development';
}

function getEnvironmentValue(name) {
  const environmentSuffix = getRuntimeEnvironment().toUpperCase();

  return process.env[`${name}_${environmentSuffix}`] || process.env[name] || '';
}

function getDatabaseUrl() {
  return getEnvironmentValue('DATABASE_URL') || getEnvironmentValue('POSTGRES_URL');
}

function loadEnvFile(filePath) {
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
