import { OVERWORLD, layerIdSchema } from '@explore/core';
import { WORLD_USAGE, flagValue, openNamedWorld } from './admin.ts';
import { landmarkNames, reseedName, restoreName } from './names.ts';

const USAGE = `usage: pnpm names (--world <id> | --owner <username>) [--restore <sx>,<sy> | --reseed <sx>,<sy>] [--layer <layer>]
  Lists every landmark in one world: the land's name, any name a player gave it, and reports.
${WORLD_USAGE}
  --restore takes a player's name off the landmark on screen sx,sy, so the land's name shows
  --reseed  puts the seed name back for good in place of one the model wrote`;

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const restore = flagValue(args, '--restore');
const reseed = flagValue(args, '--reseed');
const target = restore ?? reseed;
const at = target === undefined ? undefined : /^(-?\d+),(-?\d+)$/.exec(target);
const layer = layerIdSchema.safeParse(flagValue(args, '--layer') ?? OVERWORLD);
if ((target !== undefined && !at) || (restore && reseed) || !layer.success) {
  console.error(USAGE);
  process.exit(2);
}

const LATER = 'A running server shows the change once nobody is on that screen.';
const { db } = openNamedWorld(args);
if (at) {
  const coord = { layer: layer.data, sx: Number(at[1]), sy: Number(at[2]) };
  const where = `${coord.layer} ${coord.sx},${coord.sy}`;
  if (restore) {
    const taken = restoreName(db, coord);
    console.log(
      taken === undefined
        ? `No player has named the landmark on ${where}.`
        : `Took "${taken}" off ${where}. ${LATER}`,
    );
  } else {
    const replaced = reseedName(db, coord);
    console.log(
      replaced === undefined
        ? `No signpost on ${where}.`
        : `Put the seed name back on ${where} in place of "${replaced}". ${LATER}`,
    );
  }
} else {
  const names = landmarkNames(db);
  for (const { coord, sign, named, reports } of names) {
    const flagged = reports > 0 ? `  [${reports} report${reports === 1 ? '' : 's'}]` : '';
    const land = sign ? `"${sign.name}" [${sign.source}]` : '(no sign yet)';
    console.log(`${coord.layer} ${coord.sx},${coord.sy}  ${land}${flagged}`);
    if (sign) console.log(`    ${sign.line}`);
    if (named) console.log(`    named "${named.name}" by ${named.by}`);
    if (named?.line) console.log(`    ${named.line}`);
  }
  if (names.length === 0) console.log('No landmark has a name yet.');
}
db.close();
