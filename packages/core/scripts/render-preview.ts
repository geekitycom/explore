import { crc32 } from 'node:zlib';
import { SCREEN_H, SCREEN_W, TERRAINS, type Feature, type Terrain } from '../src/world.ts';
import { encodeRgbPng } from './png.ts';
import type { PreviewPoi, SourceScreen, WorldSource } from './world-source.ts';

export type Rgb = readonly [number, number, number];

/** A rectangle of screens: its north-west screen and its size. */
export type Area = {
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
};

export const MODES = ['terrain', 'biome'] as const;
export type Mode = (typeof MODES)[number];

export const OVERLAYS = ['roads', 'pois'] as const;
export type Overlay = (typeof OVERLAYS)[number];

export type PreviewOptions = {
  readonly area: Area;
  readonly mode: Mode;
  readonly overlays: ReadonlySet<Overlay>;
  readonly scale: number;
  readonly grid: boolean;
};

type PreviewStats = {
  readonly width: number;
  readonly height: number;
  readonly screensWithoutBiome: number;
  readonly roadTiles: number;
  readonly pois: ReadonlyMap<string, number>;
  /** Per biome, its tile count and how many of those tiles hold each feature. */
  readonly dressing: ReadonlyMap<string, { tiles: number; features: Map<Feature, number> }>;
};

export const TERRAIN_RGB: Record<Terrain, Rgb> = {
  water: [52, 101, 164],
  sand: [222, 201, 140],
  dirt: [150, 108, 70],
  path: [105, 89, 83],
  grass: [106, 170, 72],
  darkgrass: [66, 128, 52],
  snow: [236, 238, 244],
};

export const FEATURE_RGB: Record<Feature, Rgb | undefined> = {
  none: undefined,
  tree: [28, 84, 40],
  bush: [60, 120, 50],
  rock: [128, 128, 128],
  flowers: [230, 120, 170],
  tallgrass: [140, 196, 90],
  bigtree: [10, 60, 25],
  picket: [242, 234, 241],
  'picket-broken': [242, 234, 241],
  splitrail: [150, 83, 64],
  'splitrail-broken': [150, 83, 64],
  railing: [59, 54, 67],
  'railing-broken': [59, 54, 67],
  drystone: [141, 151, 127],
  'drystone-broken': [141, 151, 127],
  bones: [238, 207, 155],
  grave: [141, 151, 127],
};

export const BIOME_RGB: Readonly<Record<string, Rgb>> = {
  garden: [240, 120, 200],
  meadow: [150, 205, 95],
  forest: [30, 100, 50],
  lakeland: [70, 140, 200],
  scrubland: [190, 165, 90],
  desert: [235, 212, 145],
  highlands: [145, 115, 90],
  taiga: [70, 115, 105],
  tundra: [225, 235, 240],
};

export const ROAD_RGB: Rgb = [230, 140, 30];

/** Footprints that points of interest reserve are washed toward this under the pois overlay. */
const FOOTPRINT_RGB: Rgb = [255, 255, 255];

export const POI_RGB: Readonly<Record<string, Rgb>> = {
  hub: [255, 255, 255],
  clearing: [255, 230, 0],
  ruin: [170, 80, 220],
  lakeside: [0, 230, 230],
  grove: [150, 255, 60],
  stones: [200, 200, 210],
  town: [230, 40, 40],
  cave: [40, 20, 20],
  house: [255, 150, 60],
};

const GRID_RGB: Rgb = [0, 0, 0];

/** A stable colour for a label with no palette entry, so new kinds still render distinctly. */
export function labelRgb(palette: Readonly<Record<string, Rgb>>, label: string): Rgb {
  const known = palette[label];
  if (known) return known;
  const h = crc32(label);
  return [64 + (h & 0x7f), 64 + ((h >>> 8) & 0x7f), 64 + ((h >>> 16) & 0x7f)];
}

export function hex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function grey([r, g, b]: Rgb): Rgb {
  const l = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  return mix([l, l, l], [128, 128, 128], 0.3);
}

/** The terrain most of the four corners share; ties go to the terrain drawn on top. */
function majority(corners: readonly Terrain[]): Terrain {
  let best: Terrain = corners[0]!;
  let bestCount = 0;
  for (const t of TERRAINS) {
    const count = corners.filter((c) => c === t).length;
    if (count >= bestCount && count > 0) {
      best = t;
      bestCount = count;
    }
  }
  return best;
}

class Canvas {
  readonly width: number;
  readonly height: number;
  readonly rgb: Buffer;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.rgb = Buffer.alloc(width * height * 3);
  }

  set(x: number, y: number, [r, g, b]: Rgb): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 3;
    this.rgb[i] = r;
    this.rgb[i + 1] = g;
    this.rgb[i + 2] = b;
  }

  get(x: number, y: number): Rgb {
    const i = (y * this.width + x) * 3;
    return [this.rgb[i]!, this.rgb[i + 1]!, this.rgb[i + 2]!];
  }

  fill(x: number, y: number, w: number, h: number, colour: Rgb): void {
    for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) this.set(px, py, colour);
  }
}

function drawTile(
  canvas: Canvas,
  screen: SourceScreen,
  options: PreviewOptions,
  tx: number,
  ty: number,
  ox: number,
  oy: number,
): void {
  const { scale, mode } = options;
  const t = ty * SCREEN_W + tx;
  const corner = (cx: number, cy: number) => screen.corners[cy * (SCREEN_W + 1) + cx]!;
  const tileCorners = [
    corner(tx, ty),
    corner(tx + 1, ty),
    corner(tx, ty + 1),
    corner(tx + 1, ty + 1),
  ];
  const biome = mode === 'biome' ? screen.biomes?.[t] : undefined;
  const feature = FEATURE_RGB[screen.features[t]!];
  const marks = scale >= 4;
  const base = (terrain: Terrain): Rgb => {
    if (biome !== undefined) return labelRgb(BIOME_RGB, biome);
    const colour =
      feature && !marks ? mix(TERRAIN_RGB[terrain], feature, 0.6) : TERRAIN_RGB[terrain];
    return mode === 'biome' ? grey(colour) : colour;
  };

  for (let py = 0; py < scale; py++) {
    for (let px = 0; px < scale; px++) {
      const terrain =
        scale === 1
          ? majority(tileCorners)
          : corner(tx + (px < scale / 2 ? 0 : 1), ty + (py < scale / 2 ? 0 : 1));
      canvas.set(ox + px, oy + py, base(terrain));
    }
  }
  if (feature && marks && biome === undefined) {
    const inset = Math.floor(scale / 4);
    const colour = mode === 'biome' ? grey(feature) : feature;
    canvas.fill(ox + inset, oy + inset, scale - 2 * inset, scale - 2 * inset, colour);
  }
  if (options.overlays.has('pois') && screen.reserved?.[t]) {
    for (let py = 0; py < scale; py++) {
      for (let px = 0; px < scale; px++) {
        canvas.set(ox + px, oy + py, mix(canvas.get(ox + px, oy + py), FOOTPRINT_RGB, 0.5));
      }
    }
  }
  if (options.overlays.has('roads') && screen.roads?.[t]) {
    canvas.fill(ox, oy, scale, scale, ROAD_RGB);
  }
}

function drawPoi(canvas: Canvas, x: number, y: number, scale: number, kind: string): void {
  const r = Math.max(2, scale);
  canvas.fill(x - r - 1, y - r - 1, 2 * r + 3, 2 * r + 3, [0, 0, 0]);
  canvas.fill(x - r, y - r, 2 * r + 1, 2 * r + 1, labelRgb(POI_RGB, kind));
}

export function renderPreview(
  source: WorldSource,
  options: PreviewOptions,
): { png: Buffer; stats: PreviewStats } {
  const { area, scale } = options;
  const screenW = SCREEN_W * scale;
  const screenH = SCREEN_H * scale;
  const canvas = new Canvas(area.w * screenW, area.h * screenH);
  const pois: { x: number; y: number; poi: PreviewPoi }[] = [];
  let screensWithoutBiome = 0;
  let roadTiles = 0;
  const dressing = new Map<string, { tiles: number; features: Map<Feature, number> }>();

  for (let sy = area.y0; sy < area.y0 + area.h; sy++) {
    for (let sx = area.x0; sx < area.x0 + area.w; sx++) {
      const screen = source.screen(sx, sy);
      const ox = (sx - area.x0) * screenW;
      const oy = (sy - area.y0) * screenH;
      if (!screen.biomes) screensWithoutBiome++;
      roadTiles += screen.roads?.filter(Boolean).length ?? 0;
      screen.biomes?.forEach((biome, t) => {
        let entry = dressing.get(biome);
        if (!entry) dressing.set(biome, (entry = { tiles: 0, features: new Map() }));
        entry.tiles++;
        const feature = screen.features[t]!;
        entry.features.set(feature, (entry.features.get(feature) ?? 0) + 1);
      });
      for (let ty = 0; ty < SCREEN_H; ty++) {
        for (let tx = 0; tx < SCREEN_W; tx++) {
          drawTile(canvas, screen, options, tx, ty, ox + tx * scale, oy + ty * scale);
        }
      }
      if (options.grid) {
        for (let x = 0; x < screenW; x++)
          canvas.set(ox + x, oy, mix(canvas.get(ox + x, oy), GRID_RGB, 0.3));
        for (let y = 1; y < screenH; y++)
          canvas.set(ox, oy + y, mix(canvas.get(ox, oy + y), GRID_RGB, 0.3));
      }
      for (const poi of screen.pois ?? []) {
        pois.push({
          x: ox + Math.floor((poi.tx + 0.5) * scale),
          y: oy + Math.floor((poi.ty + 0.5) * scale),
          poi,
        });
      }
    }
  }

  const poiCounts = new Map<string, number>();
  for (const { x, y, poi } of pois) {
    poiCounts.set(poi.kind, (poiCounts.get(poi.kind) ?? 0) + 1);
    if (options.overlays.has('pois')) drawPoi(canvas, x, y, scale, poi.kind);
  }

  return {
    png: encodeRgbPng(canvas.width, canvas.height, canvas.rgb),
    stats: {
      width: canvas.width,
      height: canvas.height,
      screensWithoutBiome,
      roadTiles,
      pois: poiCounts,
      dressing,
    },
  };
}
