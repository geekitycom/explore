import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { SESSION_TIMEOUT_MS } from './e2e/session.ts';

const PORT = 4310;
// Workers load this file again; the env keeps them on the server's database.
const dbPath = (process.env['E2E_DB_PATH'] ??= join(tmpdir(), `explore-e2e-${Date.now()}.db`));

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chrome', use: { channel: 'chrome' }, testIgnore: 'touch.spec.ts' },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] }, testMatch: 'touch.spec.ts' },
  ],
  webServer: {
    command: `pnpm --filter @explore/web build && node apps/server/src/main.ts`,
    env: {
      PORT: String(PORT),
      DB_PATH: dbPath,
      TRUST_PROXY: 'true',
      SESSION_TIMEOUT_MS: String(SESSION_TIMEOUT_MS),
    },
    url: `http://localhost:${PORT}/api/me`,
    reuseExistingServer: false,
    stdout: 'pipe',
  },
});
