import { getDatabaseUrl, getOpenAiKey, getRuntimeEnvironment } from '@/lib/env';

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, ORIGINAL_ENV);
});

describe('runtime environment configuration', () => {
  it('uses development PostgreSQL and OpenAI credentials outside production', () => {
    Object.assign(process.env, { NODE_ENV: 'development' });
    process.env.DATABASE_URL_DEVELOPMENT = 'postgresql://development';
    process.env.DATABASE_URL_PRODUCTION = 'postgresql://production';
    process.env.OPENAI_KEY_DEVELOPMENT = 'development-key';
    process.env.OPENAI_KEY_PRODUCTION = 'production-key';

    expect(getRuntimeEnvironment()).toBe('development');
    expect(getDatabaseUrl()).toBe('postgresql://development');
    expect(getOpenAiKey()).toBe('development-key');
  });

  it('uses production PostgreSQL and OpenAI credentials in production', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    process.env.DATABASE_URL_DEVELOPMENT = 'postgresql://development';
    process.env.DATABASE_URL_PRODUCTION = 'postgresql://production';
    process.env.OPENAI_KEY_DEVELOPMENT = 'development-key';
    process.env.OPENAI_KEY_PRODUCTION = 'production-key';

    expect(getRuntimeEnvironment()).toBe('production');
    expect(getDatabaseUrl()).toBe('postgresql://production');
    expect(getOpenAiKey()).toBe('production-key');
  });

  it('keeps unsuffixed variables as a migration fallback', () => {
    Object.assign(process.env, { NODE_ENV: 'production' });
    delete process.env.DATABASE_URL_PRODUCTION;
    delete process.env.OPENAI_KEY_PRODUCTION;
    process.env.DATABASE_URL = 'postgresql://legacy';
    process.env.OPENAI_KEY = 'legacy-key';

    expect(getDatabaseUrl()).toBe('postgresql://legacy');
    expect(getOpenAiKey()).toBe('legacy-key');
  });
});
