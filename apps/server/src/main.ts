import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.ts';
import { openDatabase } from './db.ts';
import { createGame } from './play.ts';
import { createTextGenerator, type TextGenSettings } from './text-gen.ts';

const SAVE_INTERVAL_MS = 5000;

const dbPath = process.env.DB_PATH ?? './data/explore.db';
mkdirSync(dirname(dbPath), { recursive: true });
const db = openDatabase(dbPath);

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
const game = createGame(db, { writeText: textGen && createTextGenerator(textGen) });

const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
const { app, injectWebSocket } = createApp({
  db,
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
    db.close();
    process.exit(0);
  });
}
