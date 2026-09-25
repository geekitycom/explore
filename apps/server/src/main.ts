import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.ts';
import { openDatabase } from './db.ts';
import { createGame } from './play.ts';

const SAVE_INTERVAL_MS = 5000;

const dbPath = process.env.DB_PATH ?? './data/explore.db';
mkdirSync(dirname(dbPath), { recursive: true });
const db = openDatabase(dbPath);
const game = createGame(db);

const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
const { app, injectWebSocket } = createApp({
  db,
  game,
  secureCookies: process.env.NODE_ENV === 'production',
  trustProxy: process.env.TRUST_PROXY === 'true',
});
app.use('*', serveStatic({ root: webDist }));
app.get('*', serveStatic({ path: join(webDist, 'index.html') }));

const port = Number(process.env.PORT ?? 3000);
const server = serve({ fetch: app.fetch, port }, () =>
  console.log(`listening on http://localhost:${port}`),
);
injectWebSocket(server);

setInterval(() => game.flush(), SAVE_INTERVAL_MS).unref();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    game.stop();
    game.flush();
    db.close();
    process.exit(0);
  });
}
