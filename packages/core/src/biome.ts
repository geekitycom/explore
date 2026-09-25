import { fbm, hash4, unit } from './noise.ts';
import { SCREEN_H, SCREEN_W, type Biome } from './world.ts';

/** The biomes the climate places. The garden is a stamp, not a region. */
export type WildBiome = Exclude<Biome, 'garden'>;

/** Everything a biome changes about the land. Every value blends linearly across a border. */
export type BiomeParams = {
  /** Chance a lake cell holds a lake, 0..1. */
  readonly lakeChance: number;
  /** How large lakes grow; 1 is a temperate baseline and more favours big lakes. */
  readonly lakeSize: number;
  /** Chance a river cell holds a river, 0..1. */
  readonly riverChance: number;
  /** Width of the sand shore around a lake, in lattice units. */
  readonly shore: number;
  /** Shares of the ground, 0..1, claimed in this order. What is left is grass. */
  readonly sand: number;
  readonly dirt: number;
  readonly snow: number;
  readonly darkgrass: number;
  /** Share of the land inside woods rather than between them, 0..1. */
  readonly woods: number;
  /** Feature densities; 1 is a temperate baseline. */
  readonly trees: number;
  readonly bushes: number;
  readonly rocks: number;
  readonly flowers: number;
  readonly tallgrass: number;
  /** Bones and skulls on bare ground. Read unblended from the screen's biome, so 0 means never. */
  readonly bones: number;
  /** Chance, 0..1, of a bush on a tile in the band just outside the woods. */
  readonly undergrowth: number;
  /** Shares of the land, 0..1, given over to patches that fill with one feature. */
  readonly flowerFields: number;
  readonly stands: number;
  readonly thickets: number;
  readonly rockFields: number;
};

export const BIOME_PARAMS: Readonly<Record<WildBiome, BiomeParams>> = {
  meadow: {
    lakeChance: 0.2,
    lakeSize: 1,
    riverChance: 0.45,
    shore: 2.5,
    sand: 0,
    dirt: 0.12,
    snow: 0,
    darkgrass: 0.12,
    woods: 0.22,
    trees: 0.7,
    bushes: 1,
    rocks: 0.6,
    flowers: 1.4,
    tallgrass: 1.4,
    bones: 0,
    undergrowth: 0.35,
    flowerFields: 0.12,
    stands: 0.06,
    thickets: 0.03,
    rockFields: 0,
  },
  forest: {
    lakeChance: 0.16,
    lakeSize: 0.8,
    riverChance: 0.45,
    shore: 2,
    sand: 0,
    dirt: 0.05,
    snow: 0,
    darkgrass: 0.95,
    woods: 0.8,
    trees: 1.6,
    bushes: 1.6,
    rocks: 0.5,
    flowers: 0.3,
    tallgrass: 0.5,
    bones: 0,
    undergrowth: 0.55,
    flowerFields: 0.04,
    stands: 0,
    thickets: 0.05,
    rockFields: 0,
  },
  lakeland: {
    lakeChance: 0.8,
    lakeSize: 2.5,
    riverChance: 0.7,
    shore: 3.5,
    sand: 0,
    dirt: 0.05,
    snow: 0,
    darkgrass: 0.2,
    woods: 0.25,
    trees: 0.6,
    bushes: 1,
    rocks: 0.4,
    flowers: 0.6,
    tallgrass: 2.2,
    bones: 0,
    undergrowth: 0.35,
    flowerFields: 0.06,
    stands: 0.05,
    thickets: 0.02,
    rockFields: 0,
  },
  scrubland: {
    lakeChance: 0.07,
    lakeSize: 0.6,
    riverChance: 0.2,
    shore: 2,
    sand: 0.12,
    dirt: 0.5,
    snow: 0,
    darkgrass: 0,
    woods: 0.1,
    trees: 0.4,
    bushes: 2.5,
    rocks: 2,
    flowers: 0.2,
    tallgrass: 0.6,
    bones: 0.2,
    undergrowth: 0.3,
    flowerFields: 0.02,
    stands: 0.02,
    thickets: 0.12,
    rockFields: 0.06,
  },
  desert: {
    lakeChance: 0.09,
    lakeSize: 0.35,
    riverChance: 0.06,
    shore: 1.5,
    sand: 1,
    dirt: 0.1,
    snow: 0,
    darkgrass: 0,
    woods: 0,
    trees: 0,
    bushes: 0.4,
    rocks: 1.8,
    flowers: 0,
    tallgrass: 0,
    bones: 1,
    undergrowth: 0,
    flowerFields: 0,
    stands: 0,
    thickets: 0.03,
    rockFields: 0.1,
  },
  highlands: {
    lakeChance: 0.13,
    lakeSize: 0.7,
    riverChance: 0.5,
    shore: 1.5,
    sand: 0,
    dirt: 0.45,
    snow: 0,
    darkgrass: 0.1,
    woods: 0.12,
    trees: 0.5,
    bushes: 0.8,
    rocks: 3,
    flowers: 0.3,
    tallgrass: 0.8,
    bones: 0,
    undergrowth: 0.3,
    flowerFields: 0.05,
    stands: 0.03,
    thickets: 0.03,
    rockFields: 0.12,
  },
  taiga: {
    lakeChance: 0.2,
    lakeSize: 0.8,
    riverChance: 0.45,
    shore: 1.5,
    sand: 0,
    dirt: 0,
    snow: 0.55,
    darkgrass: 0.6,
    woods: 0.75,
    trees: 1.1,
    bushes: 0.6,
    rocks: 0.8,
    flowers: 0,
    tallgrass: 0,
    bones: 0,
    undergrowth: 0.4,
    flowerFields: 0,
    stands: 0,
    thickets: 0.04,
    rockFields: 0.03,
  },
  tundra: {
    lakeChance: 0.16,
    lakeSize: 0.8,
    riverChance: 0.2,
    shore: 1.5,
    sand: 0,
    dirt: 0.05,
    snow: 1,
    darkgrass: 0,
    woods: 0.05,
    trees: 0.3,
    bushes: 0.5,
    rocks: 1.5,
    flowers: 0,
    tallgrass: 0,
    bones: 0.1,
    undergrowth: 0.15,
    flowerFields: 0,
    stands: 0.02,
    thickets: 0.05,
    rockFields: 0.1,
  },
};

const PARAM_KEYS = Object.keys(BIOME_PARAMS.meadow) as (keyof BiomeParams)[];

/** Each biome's params in PARAM_KEYS order, which blending reads faster than by name. */
const PARAM_VALUES = Object.fromEntries(
  Object.entries(BIOME_PARAMS).map(([biome, params]) => [biome, PARAM_KEYS.map((k) => params[k])]),
) as Record<WildBiome, number[]>;

/** A biome patch, named by the grid cell whose site owns it. */
export type BiomeCell = { readonly x: number; readonly y: number };

/** Its biome and patch come from the nearest site; its params blend all nearby sites. */
export type BiomeSample = {
  readonly biome: WildBiome;
  readonly cell: BiomeCell;
  readonly params: BiomeParams;
};

/** A site fixed in place, for a hand-built area that needs a known biome around it. */
type BiomePin = { readonly x: number; readonly y: number; readonly biome: WildBiome };

export type BiomeField = (x: number, y: number) => BiomeSample;

const CELL_W = 8 * SCREEN_W;
const CELL_H = 8 * SCREEN_H;
/** Cell 0,0 is centred on screen 0,0, so a site pinned there sits in the middle of its cell. */
const GRID_X0 = SCREEN_W / 2 - CELL_W / 2;
const GRID_Y0 = SCREEN_H / 2 - CELL_H / 2;
/** Sites stay this far inside their cells, which keeps every border within two cells. */
const JITTER_MARGIN = 0.2;
const SEARCH = 2;
const WARP = 40;
/** How far past the nearest site another still weighs in: a border blends over about a screen. */
const BAND = 60;

const PURPOSE = {
  site: 0,
  temperature: 1,
  moisture: 2,
  elevation: 3,
  warpX: 4,
  warpY: 5,
} as const;

type Heat = 'cold' | 'temperate' | 'hot';
type Climate = { readonly heat: Heat; readonly moisture: number; readonly elevation: number };
type Site = {
  readonly cell: BiomeCell;
  readonly x: number;
  readonly y: number;
  readonly temperature: number;
};
type Patch = { readonly site: Site; readonly biome: WildBiome };

function heatOf(temperature: number): Heat {
  if (temperature < 0.38) return 'cold';
  return temperature > 0.58 ? 'hot' : 'temperate';
}

function biomeOf({ heat, moisture, elevation }: Climate): WildBiome {
  switch (heat) {
    case 'cold':
      return moisture > 0.48 ? 'taiga' : 'tundra';
    case 'temperate':
      if (elevation > 0.63) return 'highlands';
      if (moisture > 0.52) return elevation < 0.42 ? 'lakeland' : 'forest';
      return moisture < 0.4 && elevation > 0.52 ? 'highlands' : 'meadow';
    case 'hot':
      if (moisture < 0.45) return 'desert';
      return moisture > 0.64 ? 'lakeland' : 'scrubland';
  }
}

export function cellMemo<T>(make: (cx: number, cy: number) => T): (cx: number, cy: number) => T {
  const rows = new Map<number, Map<number, T>>();
  return (cx, cy) => {
    let row = rows.get(cy);
    if (!row) rows.set(cy, (row = new Map<number, T>()));
    let value = row.get(cx);
    if (value === undefined) row.set(cx, (value = make(cx, cy)));
    return value;
  };
}

/**
 * The biome field of one layer: a jittered site per cell of a grid about eight screens square,
 * with its biome from the climate at the site. Temperature is smooth, and a hot site with a cold
 * site within reach turns temperate, so snow never meets desert. A point belongs to the site
 * nearest its domain-warped position, which makes borders organic, and its params blend in every
 * site almost as near.
 */
export function biomeField(seed: number, pins: readonly BiomePin[]): BiomeField {
  const noise = (purpose: number, wavelength: number, octaves: number) =>
    fbm(hash4(seed, purpose, 0, 0), { wavelength, octaves });
  const temperature = noise(PURPOSE.temperature, 4 * CELL_W, 2);
  const moisture = noise(PURPOSE.moisture, 2 * CELL_W, 2);
  const elevation = noise(PURPOSE.elevation, 2.5 * CELL_W, 2);
  const warpX = noise(PURPOSE.warpX, 64, 2);
  const warpY = noise(PURPOSE.warpY, 64, 2);

  const cellX = (x: number) => Math.floor((x - GRID_X0) / CELL_W);
  const cellY = (y: number) => Math.floor((y - GRID_Y0) / CELL_H);
  const pinAt = (cx: number, cy: number) =>
    pins.find((pin) => cellX(pin.x) === cx && cellY(pin.y) === cy);

  const siteAt = cellMemo((cx, cy): Site => {
    const pin = pinAt(cx, cy);
    const jitter = (k: number) =>
      JITTER_MARGIN + (1 - 2 * JITTER_MARGIN) * unit(hash4(seed, PURPOSE.site, cx * 2 + k, cy));
    const x = pin?.x ?? GRID_X0 + (cx + jitter(0)) * CELL_W;
    const y = pin?.y ?? GRID_Y0 + (cy + jitter(1)) * CELL_H;
    return { cell: { x: cx, y: cy }, x, y, temperature: temperature(x, y) };
  });

  const nearCold = (cx: number, cy: number): boolean => {
    for (let dy = -SEARCH; dy <= SEARCH; dy++) {
      for (let dx = -SEARCH; dx <= SEARCH; dx++) {
        if (heatOf(siteAt(cx + dx, cy + dy).temperature) === 'cold') return true;
      }
    }
    return false;
  };

  const patchAt = cellMemo((cx, cy): Patch => {
    const site = siteAt(cx, cy);
    const pinned = pinAt(cx, cy)?.biome;
    if (pinned) return { site, biome: pinned };
    const raw = heatOf(site.temperature);
    const heat = raw === 'hot' && nearCold(cx, cy) ? 'temperate' : raw;
    const { x, y } = site;
    return { site, biome: biomeOf({ heat, moisture: moisture(x, y), elevation: elevation(x, y) }) };
  });

  // Successive points mostly share a cell, so the patches around the last one are kept.
  const near: Patch[] = [];
  let nearX = NaN;
  let nearY = NaN;
  const rough: number[] = [];
  const distance: number[] = [];
  return (x, y) => {
    const wx = x + (warpX(x, y) - 0.5) * 2 * WARP;
    const wy = y + (warpY(x, y) - 0.5) * 2 * WARP;
    const hx = cellX(wx);
    const hy = cellY(wy);
    if (hx !== nearX || hy !== nearY) {
      let k = 0;
      for (let dy = -SEARCH; dy <= SEARCH; dy++) {
        for (let dx = -SEARCH; dx <= SEARCH; dx++) near[k++] = patchAt(hx + dx, hy + dy);
      }
      [nearX, nearY] = [hx, hy];
    }
    // Math.hypot is slow. A plain square root rules out each site more than BAND beyond the
    // nearest, and only the rest get the exact distance the owner and the blend are chosen by.
    const n = near.length;
    let closest = Infinity;
    for (let i = 0; i < n; i++) {
      const { site } = near[i]!;
      const dx = site.x - wx;
      const dy = site.y - wy;
      rough[i] = Math.sqrt(dx * dx + dy * dy);
      closest = Math.min(closest, rough[i]!);
    }
    let owner = -1;
    for (let i = 0; i < n; i++) {
      const { site } = near[i]!;
      distance[i] =
        rough[i]! < closest + BAND + 1e-6 ? Math.hypot(site.x - wx, site.y - wy) : Infinity;
      if (owner < 0 || distance[i]! < distance[owner]!) owner = i;
    }
    const { site, biome } = near[owner]!;
    const blend: [readonly number[], number][] = [];
    for (let i = 0; i < n; i++) {
      const gap = distance[i]! - distance[owner]!;
      if (i !== owner && gap < BAND)
        blend.push([PARAM_VALUES[near[i]!.biome], (1 - gap / BAND) ** 2]);
    }
    return { biome, cell: site.cell, params: blended(biome, blend) };
  };
}

function blended(biome: WildBiome, others: readonly [readonly number[], number][]): BiomeParams {
  const base = BIOME_PARAMS[biome];
  if (others.length === 0) return base;
  let weights = 0;
  for (const [, w] of others) weights += w;
  const total = 1 + weights;
  const values = PARAM_VALUES[biome];
  const params = { ...base };
  for (let i = 0; i < PARAM_KEYS.length; i++) {
    let sum = values[i]!;
    for (const [other, w] of others) sum += w * other[i]!;
    params[PARAM_KEYS[i]!] = sum / total;
  }
  return params;
}
