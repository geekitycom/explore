import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const PACKAGES = { core: 'packages/core', server: 'apps/server', web: 'apps/web' };

export default defineConfig({
  test: {
    projects: Object.entries(PACKAGES).map(([name, root]) => ({
      extends: true,
      test: { name: `@explore/${name}`, root },
    })),
    setupFiles: [resolve(import.meta.dirname, 'vitest.setup.ts')],
  },
});
