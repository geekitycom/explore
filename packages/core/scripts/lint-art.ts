import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SHIPPED_ART, lintSheet, remapToPalette } from './art-lint.ts';
import { decodePng, encodePng } from './png.ts';

const USAGE = `usage: pnpm lint:art [--fix]
  Checks every PNG under apps/web/public against the style guide (doc-5).
  --fix   first remap each off-palette colour to its nearest palette colour`;

const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (args.some((arg) => arg !== '--fix')) {
  console.error(USAGE);
  process.exit(2);
}
const fix = args.includes('--fix');

const PUBLIC = resolve(import.meta.dirname, '../../../apps/web/public');
const pngs = readdirSync(PUBLIC, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.png'))
  .sort();

let failures = 0;
for (const path of pngs) {
  const sheet = SHIPPED_ART[path];
  if (!sheet) {
    console.error(`${path}: not listed in SHIPPED_ART (packages/core/scripts/art-lint.ts)`);
    failures++;
    continue;
  }
  let image = decodePng(readFileSync(join(PUBLIC, path)));
  if (fix) {
    const remapped = remapToPalette(image, sheet.distinct);
    if (remapped.moves.size) {
      image = remapped.image;
      writeFileSync(join(PUBLIC, path), encodePng(image));
      const moves = [...remapped.moves].map(([from, to]) => `${from}->${to}`).join(' ');
      console.log(`${path}: remapped ${moves}`);
    }
  }
  for (const { rule, x, y, colour } of lintSheet(image, sheet)) {
    console.error(`${path}:${x},${y} ${rule} ${colour}`);
    failures++;
  }
}

if (failures) {
  console.error(
    `\n${failures} style violation(s) in ${pngs.length} PNGs. See doc-5 (Style guide).`,
  );
  process.exit(1);
}
console.log(`${pngs.length} PNGs pass the style lint.`);
