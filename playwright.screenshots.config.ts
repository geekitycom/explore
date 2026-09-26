import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

/**
 * Retakes the README screenshots in docs/screenshots from the built app (`pnpm screenshots`).
 * Its own port and data directory keep it clear of a `pnpm e2e` run on the same machine.
 */
const PORT = 4320;
// Workers load this file again; the env keeps them on the server's data directory. The e2e
// helpers read the same variable.
const dataDir = (process.env['E2E_DATA_DIR'] ??= join(
  tmpdir(),
  `explore-screenshots-${Date.now()}`,
));

export default defineConfig({
  testDir: 'screenshots',
  outputDir: 'screenshots/.results',
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    launchOptions: { args: ['--mute-audio'] },
    viewport: { width: 960, height: 720 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: `pnpm --filter @explore/web build && node apps/server/src/main.ts`,
    env: { PORT: String(PORT), DATA_DIR: dataDir, TRUST_PROXY: 'true' },
    url: `http://localhost:${PORT}/api/me`,
    reuseExistingServer: false,
    stdout: 'pipe',
  },
});
