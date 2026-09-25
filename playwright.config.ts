import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

const PORT = 4310;
const dbPath = join(tmpdir(), `explore-e2e-${Date.now()}.db`);

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/.results',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `pnpm --filter @explore/web build && node apps/server/src/main.ts`,
    env: { PORT: String(PORT), DB_PATH: dbPath },
    url: `http://localhost:${PORT}/api/me`,
    reuseExistingServer: false,
    stdout: 'pipe',
  },
});
