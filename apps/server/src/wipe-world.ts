import { existsSync } from 'node:fs';
import { openWorldDatabase } from './db.ts';
import { SHARED_WORLD_ID, dataDir, worldDbPath } from './paths.ts';
import { wipeWorld } from './wipe.ts';

const dbPath = worldDbPath(dataDir(), SHARED_WORLD_ID);

if (!process.argv.includes('--yes')) {
  console.error(
    `This deletes every generated screen, trace, saved position, and inventory in ${dbPath}.\n` +
      'Accounts are kept. Stop the server first, then run:\n\n  pnpm world:wipe --yes\n',
  );
  process.exit(1);
}
if (!existsSync(dbPath)) {
  console.error(`No database at ${dbPath}. Set DATA_DIR to the directory holding it.`);
  process.exit(1);
}

const db = openWorldDatabase(dbPath, { upgradeRecords: false });
const { screens, players, traces } = wipeWorld(db);
db.close();
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
console.log(
  `Wiped ${dbPath}: removed ${plural(screens, 'screen')}, ${plural(traces, 'trace')}, and ${plural(players, 'saved position')}. The secret garden is back.`,
);
