import { WORLD_USAGE, openNamedWorld } from './admin.ts';
import { wipeWorld } from './wipe.ts';

const args = process.argv.slice(2).filter((arg) => arg !== '--');

if (!args.includes('--yes')) {
  console.error(
    'This deletes every generated screen, trace, saved position, and inventory in one world.\n' +
      'Accounts are kept. Stop the server first, then run:\n\n' +
      `  pnpm world:wipe --yes --owner <username>\n\n${WORLD_USAGE}\n`,
  );
  process.exit(1);
}

const { db, path } = openNamedWorld(args);
const { screens, players, traces } = wipeWorld(db);
db.close();
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
console.log(
  `Wiped ${path}: removed ${plural(screens, 'screen')}, ${plural(traces, 'trace')}, and ${plural(players, 'saved position')}. The secret garden is back.`,
);
