import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets two checkouts run the suite at once; the LLM stub takes the next port.
const PORT = Number(process.env['E2E_PORT'] ?? 4310);
const LLM_STUB_PORT = PORT + 1;
// Workers load this file again; the env keeps them on the server's data directory.
const dataDir = (process.env['E2E_DATA_DIR'] ??= join(tmpdir(), `explore-e2e-${Date.now()}`));

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  fullyParallel: false,
  workers: 1,
  // A stopgap while flaky specs are fixed; the flaky reporter names every retry that saved a run.
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['./e2e/flaky-reporter.ts']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: { channel: 'chrome', launchOptions: { args: ['--mute-audio'] } },
      testIgnore: 'touch.spec.ts',
    },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] }, testMatch: 'touch.spec.ts' },
  ],
  webServer: [
    {
      command: `node e2e/llm-stub.ts`,
      env: { LLM_STUB_PORT: String(LLM_STUB_PORT) },
      url: `http://localhost:${LLM_STUB_PORT}/health`,
      reuseExistingServer: false,
    },
    {
      command: `pnpm --filter @explore/web build && node apps/server/src/main.ts`,
      env: {
        PORT: String(PORT),
        DATA_DIR: dataDir,
        TRUST_PROXY: 'true',
        LLM_BASE_URL: `http://localhost:${LLM_STUB_PORT}/v1`,
        LLM_MODEL: 'stub',
        EXPLORE_TEST_HOOKS: '1',
      },
      url: `http://localhost:${PORT}/api/me`,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
  ],
});
