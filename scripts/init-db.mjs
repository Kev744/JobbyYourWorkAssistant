import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

loadDotEnvLocal();

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL or POSTGRES_URL is required.');
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
