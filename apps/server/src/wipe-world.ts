import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from './db.ts';
import { wipeWorld } from './wipe.ts';

const dbPath = resolve(process.env.DB_PATH ?? './data/explore.db');

if (!process.argv.includes('--yes')) {
  console.error(
    `This deletes every generated screen and saved position in ${dbPath}.\n` +
      'Accounts are kept. Stop the server first, then run:\n\n  pnpm world:wipe --yes\n',
  );
  process.exit(1);
}
if (!existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Set DB_PATH to point at it.`);
  process.exit(1);
}

const db = openDatabase(dbPath);
const { screens, players } = wipeWorld(db);
db.close();
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
console.log(
  `Wiped ${dbPath}: removed ${plural(screens, 'screen')} and ${plural(players, 'saved position')}. The secret garden is back.`,
);
