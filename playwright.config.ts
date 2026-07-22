import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './automation-tests',
  timeout: 30_000,
  fullyParallel: false,
  use: {
    ...devices['Desktop Chrome'],
    headless: true,
    trace: 'off',
  },
});
