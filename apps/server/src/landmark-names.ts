import { OVERWORLD, layerIdSchema } from '@explore/core';
import { WORLD_USAGE, flagValue, openNamedWorld } from './admin.ts';
import { clearName, landmarkNames } from './names.ts';

const USAGE = `usage: pnpm names (--world <id> | --owner <username>) [--clear <sx>,<sy> [--layer <layer>]]
  Lists every named landmark in one world with its reports.
${WORLD_USAGE}
  --clear   takes the name off the landmark on screen sx,sy so the next visitor can name it`;

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const clear = flagValue(args, '--clear');
const at = clear === undefined ? undefined : /^(-?\d+),(-?\d+)$/.exec(clear);
const layer = layerIdSchema.safeParse(flagValue(args, '--layer') ?? OVERWORLD);
if ((clear !== undefined && !at) || !layer.success) {
  console.error(USAGE);
  process.exit(2);
}

const { db } = openNamedWorld(args);
if (at) {
  const coord = { layer: layer.data, sx: Number(at[1]), sy: Number(at[2]) };
  const cleared = clearName(db, coord);
  console.log(
    cleared === undefined
      ? `No named landmark on ${coord.layer} ${coord.sx},${coord.sy}.`
      : `Cleared "${cleared}" from ${coord.layer} ${coord.sx},${coord.sy}. ` +
          'A running server shows the change once nobody is on that screen.',
  );
} else {
  const names = landmarkNames(db);
  for (const { coord, name, line, by, reports } of names) {
    const flagged = reports > 0 ? `  [${reports} report${reports === 1 ? '' : 's'}]` : '';
    console.log(`${coord.layer} ${coord.sx},${coord.sy}  "${name}" by ${by}${flagged}`);
    if (line) console.log(`    ${line}`);
  }
  if (names.length === 0) console.log('No landmark has a name yet.');
}
db.close();
