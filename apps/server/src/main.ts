import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.ts';
import { openMainDatabase, openWorldDatabase } from './db.ts';
import { SHARED_WORLD_ID, dataDir, mainDbPath, worldDbPath } from './paths.ts';
import { SESSION_TIMEOUT_MS, createGame } from './play.ts';
import { createTextGenerator, type TextGenSettings } from './text-gen.ts';

const SAVE_INTERVAL_MS = 5000;

const dir = dataDir();
const worldPath = worldDbPath(dir, SHARED_WORLD_ID);
mkdirSync(dirname(worldPath), { recursive: true });
const db = openMainDatabase(mainDbPath(dir));
const world = openWorldDatabase(worldPath);

const { LLM_BASE_URL, LLM_MODEL, LLM_API_KEY, LLM_TIMEOUT_MS } = process.env;
const textGen: TextGenSettings | undefined =
  LLM_BASE_URL && LLM_MODEL
    ? {
        baseUrl: LLM_BASE_URL,
        model: LLM_MODEL,
        apiKey: LLM_API_KEY || undefined,
        timeoutMs: Number(LLM_TIMEOUT_MS ?? 15000),
      }
    : undefined;
console.log(
  textGen ? `text generation: ${textGen.model} at ${textGen.baseUrl}` : 'text generation off',
);
const game = createGame(world, {
  writeText: textGen && createTextGenerator(textGen),
  sessionTimeoutMs: Number(process.env.SESSION_TIMEOUT_MS ?? SESSION_TIMEOUT_MS),
});

const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
const { app, injectWebSocket } = createApp({
  db,
  world,
  game,
  secureCookies: process.env.NODE_ENV === 'production',
  trustProxy: process.env.TRUST_PROXY === 'true',
});
const dev = process.argv.includes('--dev');
if (!dev) {
  app.use('*', serveStatic({ root: webDist }));
  app.get('*', serveStatic({ path: join(webDist, 'index.html') }));
}

const port = Number(process.env.PORT ?? 3000);
const server = serve({ fetch: app.fetch, port }, () =>
  console.log(
    dev
      ? `API listening on http://localhost:${port}. Play at the URL Vite prints.`
      : `listening on http://localhost:${port}`,
  ),
);
injectWebSocket(server);

setInterval(() => game.flush(), SAVE_INTERVAL_MS).unref();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    game.stop();
    world.close();
    db.close();
    process.exit(0);
  });
}
