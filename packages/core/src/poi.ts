import type { BiomeField, WildBiome } from './biome.ts';
import { hash4, unit } from './noise.ts';
import {
  LATTICE_H,
  LATTICE_W,
  SCREEN_H,
  SCREEN_W,
  cornerAt,
  type Feature,
  type Screen,
  type Terrain,
} from './world.ts';

/** What points of interest and roads read from the land under them. */
export type Land = {
  readonly seed: number;
  readonly biome: BiomeField;
  /** How far inside a lake's water a point is, in lattice units; negative on land. */
  readonly waterDepth: (x: number, y: number) => number;
  /** The chance, 0..1, that a tile here grows a tree. */
  readonly woods: (x: number, y: number) => number;
  /** Hand-built screens. Each is a hub, and roads never cross one. */
  readonly stamps: readonly Screen[];
};

/** One tile of a landmark, as an offset from the tile holding the point's centre. */
export type Mark = {
  readonly dx: number;
  readonly dy: number;
  readonly feature: Feature;
  /** Chance, 0..1, that the tile holds it, so a ruin's walls come out broken. */
  readonly chance?: number;
};

type PoiKindDef = {
  /** Half the width and height of the footprint the point reserves, in lattice units. */
  readonly reach: readonly [number, number];
  /** What the footprint is flattened to; the biome's plain ground when absent. */
  readonly ground?: Terrain;
  /** How often each biome places this kind relative to the others; absent means never. */
  readonly biomes: Partial<Record<WildBiome, number>>;
  /** Placed only where a lake comes within this many points of the footprint. */
  readonly shore?: number;
  /**
   * What stands in the footprint, so the place is recognisable. Roads stop at the edge of a
   * footprint that holds one, so every blocking mark sits clear of that edge.
   */
  readonly landmark: readonly Mark[];
};

function ring(n: number, rx: number, ry: number, feature: Feature, chance?: number): Mark[] {
  const marks = new Map<string, Mark>();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const dx = Math.round(Math.cos(a) * rx);
    const dy = Math.round(Math.sin(a) * ry);
    marks.set(`${dx},${dy}`, { dx, dy, feature, ...(chance === undefined ? {} : { chance }) });
  }
  return [...marks.values()];
}

/** The outline of a rectangle of tiles centred on the point. */
function walls(rx: number, ry: number, feature: Feature, chance: number): Mark[] {
  const marks: Mark[] = [];
  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx; dx++) {
      if (Math.abs(dx) === rx || Math.abs(dy) === ry) marks.push({ dx, dy, feature, chance });
    }
  }
  return marks;
}

const at = (feature: Feature, ...offsets: [number, number][]): Mark[] =>
  offsets.map(([dx, dy]) => ({ dx, dy, feature }));

/**
 * Every kind of point of interest. A new kind is one entry here: its footprint is reserved, its
 * landmark stands in it, and roads reach it without other changes. Towns and caves are placed now
 * so the network already reaches them; until their places ship they show a village green and a
 * rocky cave mouth.
 */
export const POI_KINDS = {
  hub: { reach: [SCREEN_W / 2, SCREEN_H / 2], biomes: {}, landmark: [] },
  clearing: {
    reach: [4, 3],
    biomes: { meadow: 2, forest: 3, taiga: 3, lakeland: 1 },
    landmark: [...at('bigtree', [0, 0]), ...ring(12, 3, 2, 'flowers')],
  },
  grove: {
    reach: [5, 4],
    biomes: { meadow: 2, forest: 1, scrubland: 1, lakeland: 1 },
    landmark: [...ring(8, 3, 2, 'tree'), ...at('flowers', [0, 0], [-1, 0], [1, 0])],
  },
  ruin: {
    reach: [7, 5],
    ground: 'dirt',
    biomes: { scrubland: 3, highlands: 2, desert: 3, meadow: 1 },
    landmark: [...walls(4, 2, 'rock', 0.8), ...at('rock', [-2, -1], [2, 1])],
  },
  lakeside: {
    reach: [5, 4],
    ground: 'sand',
    biomes: { lakeland: 5, meadow: 2, forest: 2, taiga: 2, scrubland: 1 },
    shore: 2,
    landmark: at('rock', [-3, -1], [-2, -2], [3, 1], [2, 2]),
  },
  stones: {
    reach: [5, 4],
    biomes: { highlands: 2, tundra: 3, meadow: 1, taiga: 1, desert: 1 },
    landmark: ring(10, 3, 2, 'rock'),
  },
  town: {
    reach: [10, 7],
    biomes: { meadow: 1, scrubland: 1, lakeland: 0.5 },
    landmark: [
      ...ring(28, 7, 5, 'bush', 0.85),
      ...at('tree', [-4, -3], [4, -3], [-4, 3], [4, 3]),
      ...at('flowers', [-1, -1], [1, -1], [-1, 1], [1, 1]),
    ],
  },
  cave: {
    reach: [4, 4],
    ground: 'dirt',
    biomes: { highlands: 3, tundra: 2, desert: 1 },
    landmark: [
      ...walls(2, 1, 'rock', 1).filter((m) => m.dy <= 0 || Math.abs(m.dx) === 2),
      ...at('rock', [-1, -2], [0, -2], [1, -2]),
    ],
  },
} as const satisfies Record<string, PoiKindDef>;

export type PoiKind = keyof typeof POI_KINDS;

const DEFS: Readonly<Record<PoiKind, PoiKindDef>> = POI_KINDS;
const KINDS = Object.keys(DEFS) as PoiKind[];

/** The walkable ground a footprint is flattened to when its kind does not say. */
const PLAIN_GROUND: Readonly<Record<WildBiome, Terrain>> = {
  meadow: 'grass',
  forest: 'darkgrass',
  lakeland: 'grass',
  scrubland: 'grass',
  desert: 'sand',
  highlands: 'grass',
  taiga: 'snow',
  tundra: 'snow',
};

/** Where a road ends at a point of interest. */
export type Port = {
  readonly x: number;
  readonly y: number;
  /** A fixed exit faces this way, and its road leaves straight out before turning. */
  readonly out?: { readonly dx: number; readonly dy: number };
};

export type PoiRegion = { readonly rx: number; readonly ry: number };

/** A point of interest, in global lattice units, with an elliptical footprint around it. */
export type Poi = {
  readonly region: PoiRegion;
  readonly kind: PoiKind;
  readonly x: number;
  readonly y: number;
  readonly reach: readonly [number, number];
  readonly ground: Terrain;
  readonly ports: readonly Port[];
};

/** At most one point per region of 6x6 screens; region 0,0 is centred on screen 0,0. */
export const REGION_W = 6 * SCREEN_W;
export const REGION_H = 6 * SCREEN_H;
const REGION_X0 = SCREEN_W / 2 - REGION_W / 2;
const REGION_Y0 = SCREEN_H / 2 - REGION_H / 2;
/** Points stay this share of a region inside it, which keeps them apart. */
const MARGIN = 0.2;
const CANDIDATES = 12;

const PURPOSE = { candidate: 0, kind: 1 } as const;

export function regionOf(x: number, y: number): PoiRegion {
  return {
    rx: Math.floor((x - REGION_X0) / REGION_W),
    ry: Math.floor((y - REGION_Y0) / REGION_H),
  };
}

export function inFootprint(poi: Poi, x: number, y: number): boolean {
  const [rx, ry] = poi.reach;
  return ((x - poi.x) / rx) ** 2 + ((y - poi.y) / ry) ** 2 <= 1;
}

/** A stamp's dirt paths meet its edge at these ports, one per run of dirt. */
function portsOf(screen: Screen): Port[] {
  const x0 = screen.coord.sx * SCREEN_W;
  const y0 = screen.coord.sy * SCREEN_H;
  const sides = [
    { out: { dx: 0, dy: -1 }, n: LATTICE_W, at: (i: number): [number, number] => [i, 0] },
    { out: { dx: 0, dy: 1 }, n: LATTICE_W, at: (i: number): [number, number] => [i, SCREEN_H] },
    { out: { dx: -1, dy: 0 }, n: LATTICE_H, at: (i: number): [number, number] => [0, i] },
    { out: { dx: 1, dy: 0 }, n: LATTICE_H, at: (i: number): [number, number] => [SCREEN_W, i] },
  ];
  const ports: Port[] = [];
  for (const { out, n, at } of sides) {
    let start = -1;
    for (let i = 0; i <= n; i++) {
      if (i < n && cornerAt(screen, ...at(i)) === 'dirt') {
        if (start < 0) start = i;
        continue;
      }
      if (start >= 0) {
        const [x, y] = at((start + i - 1) / 2);
        ports.push({ x: x0 + x, y: y0 + y, out });
      }
      start = -1;
    }
  }
  return ports;
}

function hubOf(screen: Screen, region: PoiRegion): Poi {
  return {
    region,
    kind: 'hub',
    x: (screen.coord.sx + 0.5) * SCREEN_W,
    y: (screen.coord.sy + 0.5) * SCREEN_H,
    reach: POI_KINDS.hub.reach,
    ground: 'grass',
    ports: portsOf(screen),
  };
}

function pickKind(
  land: Land,
  biome: WildBiome,
  region: PoiRegion,
  allowed: (k: PoiKind) => boolean,
): PoiKind {
  const weights = KINDS.map((k) => (allowed(k) ? (DEFS[k].biomes[biome] ?? 0) : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return 'clearing';
  let roll = unit(hash4(land.seed, PURPOSE.kind, region.rx, region.ry)) * total;
  for (let i = 0; i < KINDS.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return KINDS[i]!;
  }
  return KINDS[KINDS.length - 1]!;
}

/** Whether the footprint around (x, y), and a point beyond it, keeps clear of water. */
function isDry(land: Land, x: number, y: number, [rx, ry]: readonly [number, number]): boolean {
  for (let dy = -ry - 1; dy <= ry + 1; dy += 2) {
    for (let dx = -rx - 1; dx <= rx + 1; dx += 2) {
      if ((dx / (rx + 1)) ** 2 + (dy / (ry + 1)) ** 2 > 1) continue;
      if (land.waterDepth(x + dx, y + dy) > -1) return false;
    }
  }
  return true;
}

function nearWater(
  land: Land,
  x: number,
  y: number,
  [rx, ry]: readonly [number, number],
  by: number,
) {
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * 2 * Math.PI;
    if (land.waterDepth(x + Math.cos(a) * (rx + by), y + Math.sin(a) * (ry + by)) > 0) return true;
  }
  return false;
}

/**
 * Moves a spot so the kind's footprint, with a tile to spare, lies within one screen, when it is
 * small enough to. A landmark is then seen whole rather than split across a seam.
 */
function onOneScreen(kind: PoiKind, { x, y }: { x: number; y: number }) {
  const [rx, ry] = DEFS[kind].reach;
  const into = (v: number, size: number, r: number) => {
    if (2 * (r + 1) > size) return v;
    const s0 = Math.floor(v / size) * size;
    return Math.min(Math.max(v, s0 + r + 1), s0 + size - r - 1);
  };
  return { x: into(x, SCREEN_W, rx), y: into(y, SCREEN_H, ry) };
}

/**
 * The region's point of interest, a pure function of the land and the region. A region holding a
 * stamp's centre gets the stamp as its hub. Otherwise the kind follows the biome, and the point
 * takes the first of a few seeded spots whose footprint is dry (and, for a shore kind, near water).
 */
export function poiIn(land: Land, region: PoiRegion): Poi {
  const stamp = land.stamps.find((s) => {
    const r = regionOf((s.coord.sx + 0.5) * SCREEN_W, (s.coord.sy + 0.5) * SCREEN_H);
    return r.rx === region.rx && r.ry === region.ry;
  });
  if (stamp) return hubOf(stamp, region);

  const spots = Array.from({ length: CANDIDATES }, (_, k) => {
    const jitter = (axis: number) =>
      MARGIN +
      (1 - 2 * MARGIN) *
        unit(hash4(hash4(land.seed, PURPOSE.candidate, k, axis), region.rx, region.ry, 0));
    return {
      x: REGION_X0 + (region.rx + jitter(0)) * REGION_W,
      y: REGION_Y0 + (region.ry + jitter(1)) * REGION_H,
    };
  });
  const { biome } = land.biome(spots[0]!.x, spots[0]!.y);
  const fits = (kind: PoiKind, { x, y }: { x: number; y: number }) => {
    const def = DEFS[kind];
    if (!isDry(land, x, y, def.reach)) return false;
    return def.shore === undefined || nearWater(land, x, y, def.reach, def.shore);
  };
  const place = (kind: PoiKind) =>
    spots.map((s) => onOneScreen(kind, s)).find((s) => fits(kind, s));
  let kind = pickKind(land, biome, region, () => true);
  let spot = place(kind);
  if (!spot) {
    kind = pickKind(land, biome, region, (k) => DEFS[k].shore === undefined);
    spot = place(kind) ?? spots[0]!;
  }
  const def = DEFS[kind];
  return {
    region,
    kind,
    ...spot,
    reach: def.reach,
    ground: def.ground ?? PLAIN_GROUND[land.biome(spot.x, spot.y).biome],
    ports: [spot],
  };
}

/** The landmark feature on a global tile, if the point's landmark stands there. */
export function landmarkAt(poi: Poi, gtx: number, gty: number): Feature | undefined {
  const cx = Math.floor(poi.x);
  const cy = Math.floor(poi.y);
  const mark = DEFS[poi.kind].landmark.find((m) => m.dx === gtx - cx && m.dy === gty - cy);
  if (!mark) return undefined;
  if (mark.chance !== undefined && unit(hash4(cx, cy, mark.dx, mark.dy)) >= mark.chance) {
    return undefined;
  }
  return mark.feature;
}

/** Whether a lattice point lies in a footprint whose landmark roads stop short of. */
export function holdsLandmark(poi: Poi, x: number, y: number): boolean {
  return DEFS[poi.kind].landmark.length > 0 && inFootprint(poi, x, y);
}
