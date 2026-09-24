import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.ts';
import { openDatabase } from './db.ts';

const dbPath = process.env.DB_PATH ?? './data/explore.db';
mkdirSync(dirname(dbPath), { recursive: true });
const db = openDatabase(dbPath);

const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
const app = createApp({ db, secureCookies: process.env.NODE_ENV === 'production' });
app.use('*', serveStatic({ root: webDist }));
app.get('*', serveStatic({ path: join(webDist, 'index.html') }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`listening on http://localhost:${port}`));
