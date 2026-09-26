import { EPITAPH_MAX, OVERWORLD, layerIdSchema } from '@explore/core';
import { WORLD_USAGE, openNamedWorld } from './admin.ts';
import { listEpitaphs, setEpitaph } from './epitaphs.ts';

const USAGE = `usage: pnpm epitaphs (--world <id> | --owner <username>) [--set <sx>,<sy> <tx>,<ty> <text> | --clear <sx>,<sy> <tx>,<ty>] [--layer <layer>]
  Lists every grave's epitaph in one world with who wrote it.
${WORLD_USAGE}
  --set     replaces the epitaph on grave tx,ty of screen sx,sy (at most ${EPITAPH_MAX} characters)
  --clear   puts that grave's seed epitaph back for good`;

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const flag = (name: string, count: number) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args.slice(i + 1, i + 1 + count);
};
const set = flag('--set', 3);
const clear = flag('--clear', 2);
const edit = set ?? clear;
const pair = (arg: string | undefined) => /^(-?\d+),(-?\d+)$/.exec(arg ?? '');
const screen = pair(edit?.[0]);
const tile = pair(edit?.[1]);
const text = set?.[2]?.replace(/\s+/g, ' ').trim();
const layer = layerIdSchema.safeParse(flag('--layer', 1)?.[0] ?? OVERWORLD);
const badText =
  set !== undefined && (!text || text.length > EPITAPH_MAX || /\p{C}/u.test(text ?? ''));
if ((set && clear) || (edit && (!screen || !tile)) || badText || !layer.success) {
  console.error(USAGE);
  process.exit(2);
}

const { db } = openNamedWorld(args);
if (screen && tile) {
  const coord = { layer: layer.data, sx: Number(screen[1]), sy: Number(screen[2]) };
  const at = { tx: Number(tile[1]), ty: Number(tile[2]) };
  const where = `${coord.layer} ${coord.sx},${coord.sy} grave ${at.tx},${at.ty}`;
  const replaced = setEpitaph(db, coord, at, text);
  console.log(
    replaced === undefined
      ? `No epitaph on ${where}. A grave gets one when a player first opens its screen.`
      : `Replaced "${replaced}" on ${where}. ` +
          'A running server shows the change once nobody is on that screen.',
  );
} else {
  const epitaphs = listEpitaphs(db);
  for (const { coord, tile: at, text: words, source } of epitaphs) {
    console.log(`${coord.layer} ${coord.sx},${coord.sy} ${at.tx},${at.ty}  [${source}] ${words}`);
  }
  if (epitaphs.length === 0) console.log('No grave has an epitaph yet.');
}
db.close();
