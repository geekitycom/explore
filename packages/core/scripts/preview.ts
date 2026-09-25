import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BIOME_RGB,
  FEATURE_RGB,
  MODES,
  OVERLAYS,
  POI_RGB,
  ROAD_RGB,
  TERRAIN_RGB,
  hex,
  labelRgb,
  renderPreview,
  type Area,
  type Mode,
  type Overlay,
  type PreviewOptions,
  type Rgb,
} from './render-preview.ts';
import { neighbourSource } from './world-source.ts';

const USAGE = `usage: pnpm --filter @explore/core preview -- [options]
  --seed <n>             world seed (default 1)
  --area <x0,y0,w,h>     area in screens (default -16,-16,32,32, centred on the garden)
  --mode terrain|biome   colour tiles by terrain or biome (default terrain)
  --overlay roads,pois   overlays to draw (default none)
  --scale <px>           pixels per tile (default 1)
  --grid                 faint screen-grid lines
  --out <file.png>       output path (default world-preview.png)`;

function fail(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

function int(name: string, value: string): number {
  if (!/^-?\d+$/.test(value)) fail(`--${name} must be an integer, got "${value}"`);
  return Number(value);
}

function parseOptions(argv: string[]): { seed: number; out: string; options: PreviewOptions } {
  const values = {
    seed: '1',
    area: '-16,-16,32,32',
    mode: 'terrain',
    overlay: '',
    scale: '1',
    out: 'world-preview.png',
  };
  let grid = false;
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    }
    if (arg === '--grid') {
      grid = true;
      continue;
    }
    const name = arg.slice(2);
    if (!arg.startsWith('--') || !Object.hasOwn(values, name)) fail(`unknown option "${arg}"`);
    const value = args[++i];
    if (value === undefined) fail(`${arg} needs a value`);
    values[name as keyof typeof values] = value;
  }

  const parts = values.area.split(',');
  if (parts.length !== 4) fail(`--area takes x0,y0,w,h, got "${values.area}"`);
  const [x0, y0, w, h] = parts.map((p) => int('area', p.trim())) as [
    number,
    number,
    number,
    number,
  ];
  if (w < 1 || h < 1) fail('--area width and height must be at least 1');
  const area: Area = { x0, y0, w, h };

  if (!(MODES as readonly string[]).includes(values.mode)) fail(`unknown --mode "${values.mode}"`);
  const overlays = values.overlay
    .split(',')
    .filter(Boolean)
    .map((o) => {
      if (!(OVERLAYS as readonly string[]).includes(o)) fail(`unknown --overlay "${o}"`);
      return o as Overlay;
    });
  const scale = int('scale', values.scale);
  if (scale < 1 || scale > 64) fail('--scale must be between 1 and 64');

  return {
    seed: int('seed', values.seed),
    out: resolve(process.env.INIT_CWD ?? process.cwd(), values.out),
    options: { area, mode: values.mode as Mode, overlays: new Set(overlays), scale, grid },
  };
}

const swatches = (palette: Readonly<Record<string, Rgb | undefined>>) =>
  Object.entries(palette)
    .flatMap(([name, rgb]) => (rgb ? [`${name} ${hex(rgb)}`] : []))
    .join(', ');

const { seed, out, options } = parseOptions(process.argv.slice(2));
const { area, mode, overlays, scale } = options;
const source = neighbourSource(seed);
const started = performance.now();
const { png, stats } = renderPreview(source, options);
const elapsed = Math.round(performance.now() - started);
writeFileSync(out, png);

const screens = area.w * area.h;
console.log(`seed ${seed}, source ${source.name}`);
console.log(
  `area screens x ${area.x0}..${area.x0 + area.w - 1}, y ${area.y0}..${area.y0 + area.h - 1} (${area.w}x${area.h}), garden at 0,0`,
);
console.log(`image ${stats.width}x${stats.height} px, ${scale} px per tile`);
if (mode === 'terrain') {
  console.log(`terrain: ${swatches(TERRAIN_RGB)}`);
  console.log(
    `features${scale >= 4 ? ' (marks)' : ' (tinted into the tile)'}: ${swatches(FEATURE_RGB)}`,
  );
} else {
  console.log(`biome: ${swatches(BIOME_RGB)}, other labels get a hashed colour`);
  if (stats.screensWithoutBiome > 0) {
    console.log(
      `note: ${stats.screensWithoutBiome} of ${screens} screens have no biome data; drawn as greyed terrain`,
    );
  }
}
if (overlays.has('roads')) console.log(`roads ${hex(ROAD_RGB)}: ${stats.roadTiles} tiles`);
if (overlays.has('pois')) {
  const counts = [...stats.pois].map(
    ([kind, n]) => `${kind} ${hex(labelRgb(POI_RGB, kind))} x${n}`,
  );
  console.log(`pois: ${counts.join(', ') || 'none'}`);
}
console.log(`wrote ${out} in ${elapsed} ms`);
