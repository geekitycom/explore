import {
  BIOME_PARAMS,
  biomeField,
  cellMemo,
  type BiomeField,
  type BiomeParams,
  type BiomeSample,
} from './biome.ts';
import { isFence } from './fences.ts';
import { secretGarden } from './garden.ts';
import { fbm, hash4, hashString, unit, type Noise2 } from './noise.ts';
import type { Land } from './poi.ts';
import { FAR, RIVER_CELL_H, RIVER_CELL_W, riverDepth, riverField, type River } from './rivers.ts';
import { roadNetwork, type Box, type Network, type Plan } from './roads.ts';
import { isTileWalkable } from './walk.ts';
import {
  BLOCKING_FEATURES,
  LATTICE_H,
  LATTICE_W,
  SCREEN_H,
  SCREEN_W,
  cornerAt,
  featureAt,
  inScreen,
  tileCorners,
  tileIndex,
  type Biome,
  type Feature,
  type LayerId,
  type Screen,
  type ScreenCoord,
  type Terrain,
  type World,
} from './world.ts';

/** Inside its footprint, boundary included, the fields return this screen verbatim. */
type Stamp = { readonly screen: Screen };

const STAMPS: readonly Stamp[] = [{ screen: secretGarden() }];

/**
 * Bumped whenever the generator's output changes. Stored screens record the version that made
 * them and are kept as they are, so a bump never invalidates a world: a new screen copies the
 * lattice points it shares with a stored older neighbour, blends into them over STITCH_REACH
 * points, and opens onto that neighbour's walkable edge (decision D23).
 */
export const GENERATOR_VERSION = 8;

/**
 * Looks up a stored screen that an older generator made; undefined for a screen the current
 * generator made or that is not stored. A new screen keeps such a neighbour's shared edge.
 */
export type Older = (coord: ScreenCoord) => Screen | undefined;

const NO_OLDER: Older = () => undefined;

/** How many lattice points a new screen takes to blend from an older neighbour's edge to the fields. */
export const STITCH_REACH = 6;

const CLEARING_SCREENS = 1.5;

const PURPOSE = {
  layer: 0,
  dryness: 1,
  forest: 2,
  bloom: 3,
  place: 4,
  crossingV: 5,
  crossingH: 6,
  bones: 7,
  lake: 8,
  shore: 9,
  clump: 10,
  carve: 11,
  biome: 12,
  sand: 13,
  snow: 14,
  darkgrass: 15,
  stitch: 16,
  shrub: 17,
  lakes: 18,
  river: 19,
  patch: 20,
} as const;

/**
 * One lake at most per cell of this grid, kept inside the cell with a margin so no two lakes touch,
 * and never reaching past LAKE_EXTENT from its centre. A disc that small cannot hold a screen's
 * lattice rectangle, so no screen is all water, and a road never detours far round a lake. Land
 * therefore stays connected everywhere, which is what lets the repair below leave water alone.
 */
const LAKE_CELL_W = 40;
const LAKE_CELL_H = 32;
const LAKE_MARGIN = 1;
const LAKE_EXTENT = 13;
const LAKE_WOBBLE = 0.25;
const LAKE_MIN_RADIUS = 2.5;
/** Only a lake this wide grows lobes, which keeps each lobe broad enough for roads to see. */
const LAKE_LOBED = 6;

/** An ellipse of water; a lake is a main basin and a few smaller lobes that overlap it. */
type Basin = {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly angle: number;
};

type Lake = {
  readonly basins: readonly Basin[];
  readonly phase: readonly [number, number, number];
};

/** The layer's noise fields, lakes, and stamps: everything the road network is laid over. */
type LandFields = {
  readonly seed: number;
  readonly biome: BiomeField;
  readonly stamps: readonly Stamp[];
  /** The lakes of a lake cell and its eight neighbours, since shores can spill into the next cell. */
  readonly lakes: (cellX: number, cellY: number) => readonly Lake[];
  /** The rivers of a river cell and its eight neighbours. */
  readonly rivers: (cellX: number, cellY: number) => readonly River[];
  readonly dryness: Noise2;
  readonly sand: Noise2;
  readonly snow: Noise2;
  readonly darkgrass: Noise2;
  readonly forest: Noise2;
  readonly clump: Noise2;
  readonly bloom: Noise2;
  readonly shore: Noise2;
  /** Where lakes gather: a low-frequency field that scales every cell's lake chance. */
  readonly lakeDistrict: Noise2;
  /** One detail field per entry of PATCHES. */
  readonly patches: readonly Noise2[];
};

type Fields = LandFields & { readonly network: Network };

const fieldsCache = new Map<string, Fields>();

/** Fields cache their lakes and biome sites, so they are kept for the few worlds and layers in use. */
function fieldsOf(world: World, layer: LayerId): Fields {
  const key = `${world.seed}/${layer}`;
  let fields = fieldsCache.get(key);
  if (!fields) {
    if (fieldsCache.size >= 8) fieldsCache.clear();
    fields = makeFields(world, layer);
    fieldsCache.set(key, fields);
  }
  return fields;
}

function makeFields(world: World, layer: LayerId): Fields {
  const seed = hash4(world.seed, PURPOSE.layer, hashString(layer), 0);
  const field = (purpose: number) => hash4(seed, purpose, 0, 0);
  const stamps = STAMPS.filter((s) => s.screen.coord.layer === layer);
  const pins = stamps.map(({ screen }) => ({
    x: (screen.coord.sx + 0.5) * SCREEN_W,
    y: (screen.coord.sy + 0.5) * SCREEN_H,
    biome: 'meadow' as const,
  }));
  const biome = biomeField(field(PURPOSE.biome), pins);
  const fields: LandFields = {
    seed,
    biome,
    stamps,
    lakes: nineCells((cellX, cellY) => {
      const lake = makeLake(fields, cellX, cellY);
      return lake ? [lake] : [];
    }),
    rivers: nineCells(riverField(field(PURPOSE.river), biome, (box) => !inClearing(stamps, box))),
    dryness: fbm(field(PURPOSE.dryness), { wavelength: 22, octaves: 3 }),
    sand: fbm(field(PURPOSE.sand), { wavelength: 14, octaves: 3 }),
    snow: fbm(field(PURPOSE.snow), { wavelength: 16, octaves: 3 }),
    darkgrass: fbm(field(PURPOSE.darkgrass), { wavelength: 18, octaves: 3 }),
    forest: fbm(field(PURPOSE.forest), { wavelength: 56, octaves: 3 }),
    clump: fbm(field(PURPOSE.clump), { wavelength: 5, octaves: 2 }),
    bloom: fbm(field(PURPOSE.bloom), { wavelength: 18, octaves: 2 }),
    shore: fbm(field(PURPOSE.shore), { wavelength: 12, octaves: 2 }),
    lakeDistrict: fbm(field(PURPOSE.lakes), { wavelength: 90, octaves: 2 }),
    patches: PATCHES.map((_, i) =>
      fbm(field(PURPOSE.patch + i), { wavelength: PATCH_WAVELENGTH, octaves: 3 }),
    ),
  };
  return { ...fields, network: roadNetwork(landOf(fields)) };
}

/** What a cell and its eight neighbours hold, north-west first, memoized per cell. */
function nineCells<T>(
  cell: (cx: number, cy: number) => readonly T[],
): (cx: number, cy: number) => readonly T[] {
  const one = cellMemo(cell);
  return cellMemo((cx, cy) => AROUND.flatMap(({ dx, dy }) => one(cx + dx, cy + dy)));
}

function landOf(f: LandFields): Land {
  return {
    seed: f.seed,
    biome: f.biome,
    waterDepth: (x, y) => waterDepth(f, x, y),
    riverDepth: (x, y) => riverDepthAt(f, x, y),
    woods: (x, y) => woodsAt(f, x, y, f.biome(x, y).params, 1 - clearing(f, x, y)),
    stamps: f.stamps.map((s) => s.screen),
  };
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The noise level below which about `share` of a three-octave fBm field lies. */
function threshold(share: number): number {
  if (share <= 0) return -Infinity;
  if (share >= 1) return Infinity;
  return 0.5 + 0.088 * Math.log(share / (1 - share));
}

function stampAt(f: Fields, sx: number, sy: number): Stamp | undefined {
  return f.stamps.find((s) => s.screen.coord.sx === sx && s.screen.coord.sy === sy);
}

function stampCorner(f: Fields, gx: number, gy: number): Terrain | undefined {
  for (const { screen } of f.stamps) {
    const x = gx - screen.coord.sx * SCREEN_W;
    const y = gy - screen.coord.sy * SCREEN_H;
    if (x >= 0 && y >= 0 && x < LATTICE_W && y < LATTICE_H) return cornerAt(screen, x, y);
  }
  return undefined;
}

function stampFeature(f: Fields, gtx: number, gty: number): Feature | undefined {
  for (const { screen } of f.stamps) {
    const x = gtx - screen.coord.sx * SCREEN_W;
    const y = gty - screen.coord.sy * SCREEN_H;
    if (x >= 0 && y >= 0 && x < SCREEN_W && y < SCREEN_H) return featureAt(screen, x, y);
  }
  return undefined;
}

function clearingBox(screen: Screen) {
  const x0 = screen.coord.sx * SCREEN_W;
  const y0 = screen.coord.sy * SCREEN_H;
  const rx = CLEARING_SCREENS * SCREEN_W;
  const ry = CLEARING_SCREENS * SCREEN_H;
  return { x0: x0 - rx, x1: x0 + SCREEN_W + rx, y0: y0 - ry, y1: y0 + SCREEN_H + ry };
}

function inClearing(stamps: readonly Stamp[], { x0, y0, x1, y1 }: Box): boolean {
  return stamps.some(({ screen }) => {
    const box = clearingBox(screen);
    return x1 > box.x0 && x0 < box.x1 && y1 > box.y0 && y0 < box.y1;
  });
}

function clearing(f: LandFields, x: number, y: number): number {
  let best = 0;
  for (const { screen } of f.stamps) {
    const x0 = screen.coord.sx * SCREEN_W;
    const y0 = screen.coord.sy * SCREEN_H;
    const dx = Math.max(0, x0 - x, x - x0 - SCREEN_W) / (CLEARING_SCREENS * SCREEN_W);
    const dy = Math.max(0, y0 - y, y - y0 - SCREEN_H) / (CLEARING_SCREENS * SCREEN_H);
    best = Math.max(best, 1 - smoothstep(clamp01(Math.hypot(dx, dy))));
  }
  return best;
}

/**
 * Lakes gather where a slow field says so, rather than one to a cell everywhere, and come in a
 * spread of sizes. A wide one is a main basin with up to three lobes budding off it, so its shore
 * has bays and points.
 */
function makeLake(f: LandFields, cellX: number, cellY: number): Lake | undefined {
  const cell = hash4(f.seed, PURPOSE.lake, cellX, cellY);
  const roll = (k: number) => unit(hash4(cell, k, 0, 0));
  const mx = (cellX + 0.5) * LAKE_CELL_W;
  const my = (cellY + 0.5) * LAKE_CELL_H;
  const { params } = f.biome(mx, my);
  const gathering = 0.15 + 1.1 * smoothstep(clamp01((f.lakeDistrict(mx, my) - 0.32) / 0.36));
  if (roll(0) >= params.lakeChance * gathering) return undefined;
  const grow = 1 + LAKE_WOBBLE;
  const size = roll(1) ** (1.1 / params.lakeSize);
  const rx = lerp(LAKE_MIN_RADIUS, LAKE_EXTENT / grow, size);
  const main: Basin = {
    cx: 0,
    cy: 0,
    rx,
    ry: rx * (0.45 + 0.55 * roll(2)),
    angle: roll(3) * Math.PI,
  };
  const basins = [main];
  const lobes = rx < LAKE_LOBED ? 0 : Math.floor(roll(9) * 4);
  for (let k = 0; k < lobes; k++) {
    const at = roll(10 + 2 * k) * 2 * Math.PI;
    const r = rx * (0.4 + 0.35 * roll(11 + 2 * k));
    const off = rx * (0.7 + 0.4 * roll(16 + k));
    basins.push({ cx: Math.cos(at) * off, cy: Math.sin(at) * off, rx: r, ry: r, angle: 0 });
  }
  const extent = Math.max(...basins.map((b) => Math.hypot(b.cx, b.cy) + b.rx * grow));
  const fit = Math.min(1, LAKE_EXTENT / extent);
  const bound = extent * fit + LAKE_MARGIN;
  const cx = cellX * LAKE_CELL_W + lerp(bound, LAKE_CELL_W - bound, roll(4));
  const cy = cellY * LAKE_CELL_H + lerp(bound, LAKE_CELL_H - bound, roll(5));
  const box = { x0: cx - bound, y0: cy - bound, x1: cx + bound, y1: cy + bound };
  if (inClearing(f.stamps, box) || riverDepthAt(f, cx, cy) > -(bound + LAKE_MARGIN)) {
    return undefined;
  }
  const phase = (k: number) => roll(6 + k) * 2 * Math.PI;
  return {
    basins: basins.map((b) => ({
      cx: cx + b.cx * fit,
      cy: cy + b.cy * fit,
      rx: b.rx * fit,
      ry: b.ry * fit,
      angle: b.angle,
    })),
    phase: [phase(0), phase(1), phase(2)],
  };
}

/**
 * How far inside a lake's water a point is, in lattice units, negative outside; or `floor` where
 * that is deeper. A basin's shore lies within its wobbled long radius, so a basin that cannot
 * reach past `floor` is skipped. The slack absorbs rounding, which keeps the result exact.
 */
function lakeDepth({ basins, phase }: Lake, x: number, y: number, floor: number): number {
  let depth = floor;
  for (const basin of basins) {
    const ox = x - basin.cx;
    const oy = y - basin.cy;
    const reach = Math.max(basin.rx, basin.ry) * (1 + LAKE_WOBBLE) - Math.hypot(ox, oy);
    if (reach + 1e-6 <= depth) continue;
    const dx = ox * Math.cos(basin.angle) + oy * Math.sin(basin.angle);
    const dy = -ox * Math.sin(basin.angle) + oy * Math.cos(basin.angle);
    const angle = Math.atan2(dy, dx);
    const [p0, p1, p2] = phase;
    const lobes =
      0.5 * Math.sin(2 * angle + p0) +
      0.3 * Math.sin(3 * angle + p1) +
      0.2 * Math.sin(5 * angle + p2);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const radius = (basin.rx * basin.ry) / Math.hypot(basin.ry * cos, basin.rx * sin);
    depth = Math.max(depth, radius * (1 + LAKE_WOBBLE * lobes) - Math.hypot(dx, dy));
  }
  return depth;
}

function riverDepthAt(f: LandFields, x: number, y: number): number {
  const cellX = Math.floor(x / RIVER_CELL_W);
  const cellY = Math.floor(y / RIVER_CELL_H);
  let depth = -Infinity;
  for (const river of f.rivers(cellX, cellY)) depth = Math.max(depth, riverDepth(river, x, y));
  return depth;
}

/** Lakes that cannot reach -FAR here are skipped, as rivers are. */
function waterDepth(f: LandFields, x: number, y: number): number {
  let depth = Math.max(riverDepthAt(f, x, y), -FAR);
  for (const lake of f.lakes(Math.floor(x / LAKE_CELL_W), Math.floor(y / LAKE_CELL_H))) {
    depth = lakeDepth(lake, x, y, depth);
  }
  return depth;
}

/** The screen being generated: its layer's fields and the stored older screens around it. */
type Surroundings = { readonly f: Fields; readonly plan: Plan; readonly older: readonly Screen[] };

/** Its terrain is memoized, since the crossings look again at points the corners already hold. */
type Site = Surroundings & { readonly terrain: (gx: number, gy: number) => Terrain };

const AROUND = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ dx, dy })));

/**
 * Every older stored screen touching the screen at `coord`, in coordinate order so that two new
 * screens sharing a seam pick the same nearest one.
 */
function siteOf(world: World, { layer, sx, sy }: ScreenCoord, older: Older): Site {
  const around: Screen[] = [];
  for (const { dx, dy } of AROUND) {
    if (dx === 0 && dy === 0) continue;
    const stored = older({ layer, sx: sx + dx, sy: sy + dy });
    if (stored) around.push(stored);
  }
  around.sort((a, b) => a.coord.sy - b.coord.sy || a.coord.sx - b.coord.sx);
  const f = fieldsOf(world, layer);
  const surroundings = { f, plan: planOf(f, sx, sy), older: around };
  return { ...surroundings, terrain: cellMemo((gx, gy) => siteTerrain(surroundings, gx, gy)) };
}

/** The network's plan for a screen's lattice and the points just outside it. */
function planOf(f: Fields, sx: number, sy: number): Plan {
  const x0 = sx * SCREEN_W;
  const y0 = sy * SCREEN_H;
  return f.network.plan({ x0: x0 - 1, y0: y0 - 1, x1: x0 + SCREEN_W + 1, y1: y0 + SCREEN_H + 1 });
}

/**
 * The terrain at a lattice point, stitched to older neighbours: a point an older screen holds
 * keeps that screen's value, a stamp's point keeps the stamp's, and within STITCH_REACH of an
 * older screen the fields' value is dithered with the nearest held value, so the join is a band
 * rather than a line. Water is never added in the band (sand stands in for it), so the land
 * stays as connected as the fields made it. A road is not dithered, so it runs solid up to the
 * older screen's edge and ends there. The result depends only on the point and the older
 * screens within reach, which two new screens sharing a seam both see, so they agree on it.
 */
function siteTerrain({ f, plan, older }: Surroundings, gx: number, gy: number): Terrain {
  let nearest: { screen: Screen; x: number; y: number; d: number } | undefined;
  for (const screen of older) {
    const x = Math.min(Math.max(gx - screen.coord.sx * SCREEN_W, 0), SCREEN_W);
    const y = Math.min(Math.max(gy - screen.coord.sy * SCREEN_H, 0), SCREEN_H);
    const d = Math.max(
      Math.abs(gx - screen.coord.sx * SCREEN_W - x),
      Math.abs(gy - screen.coord.sy * SCREEN_H - y),
    );
    if (!nearest || d < nearest.d) nearest = { screen, x, y, d };
  }
  if (nearest?.d === 0) return cornerAt(nearest.screen, nearest.x, nearest.y);
  const field = terrainAt(f, plan, gx, gy);
  if (!nearest || nearest.d >= STITCH_REACH || stampCorner(f, gx, gy) || plan.road(gx, gy)) {
    return field;
  }
  const held = cornerAt(nearest.screen, nearest.x, nearest.y);
  if (held === field) return field;
  const t = unit(hash4(f.seed, PURPOSE.stitch, gx, gy));
  const picked = t < 1 - nearest.d / STITCH_REACH ? held : field;
  return picked === 'water' ? 'sand' : picked;
}

/** Stamps win, then roads (sand where they ford water), then footprints, then the fields. */
function terrainAt(f: Fields, plan: Plan, gx: number, gy: number): Terrain {
  const stamped = stampCorner(f, gx, gy);
  if (stamped) return stamped;
  const depth = waterDepth(f, gx, gy);
  if (plan.road(gx, gy)) return depth > 0 ? 'sand' : 'path';
  const ground = plan.ground(gx, gy);
  if (ground) return ground;
  if (depth > 0) return 'water';
  const p = f.biome(gx, gy).params;
  if (depth > -p.shore * 1.6 * smoothstep(clamp01((f.shore(gx, gy) - 0.3) / 0.4))) return 'sand';
  const open = 1 - clearing(f, gx, gy);
  if (f.sand(gx, gy) < threshold(p.sand * open)) return 'sand';
  if (f.dryness(gx, gy) < threshold(p.dirt * open)) return 'dirt';
  if (f.snow(gx, gy) < threshold(p.snow * open)) return 'snow';
  if (f.darkgrass(gx, gy) < threshold(p.darkgrass * open)) return 'darkgrass';
  return 'grass';
}

type Crossing = readonly number[];

type Crossings = {
  readonly n: Crossing;
  readonly e: Crossing;
  readonly s: Crossing;
  readonly w: Crossing;
};

const CROSSING_WIDTH = 2;

function terrainWalkable(site: Site, gtx: number, gty: number): boolean {
  let water = 0;
  for (const [dx, dy] of CORNER_OFFSETS) {
    if (site.terrain(gtx + dx, gty + dy) === 'water') water++;
  }
  return water < 3;
}

/** A stamp or an older stored screen at (sx, sy), whose edge the new screen must open onto. */
function fixedAt(site: Site, sx: number, sy: number): Screen | undefined {
  return (
    stampAt(site.f, sx, sy)?.screen ??
    site.older.find((s) => s.coord.sx === sx && s.coord.sy === sy)
  );
}

const CORNER_OFFSETS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const;

/**
 * A pure function of the seam, so the screens on both sides agree on it. Against a fixed screen
 * (a stamp or an older stored neighbour) the crossing is every tile of that screen's main land
 * that is walkable on its side and open by terrain on ours, so the new screen opens onto all of
 * the old one's edge.
 */
function crossing(
  site: Site,
  axis: 'v' | 'h',
  at: number,
  along: number,
  length: number,
  purpose: number,
): Crossing {
  const { f } = site;
  const base = along * length;
  // Global tiles either side of the seam: `before` is west or north of it, `after` east or south.
  const beforeTile = (i: number): [number, number] =>
    axis === 'v' ? [at * SCREEN_W - 1, base + i] : [base + i, at * SCREEN_H - 1];
  const afterTile = (i: number): [number, number] =>
    axis === 'v' ? [at * SCREEN_W, base + i] : [base + i, at * SCREEN_H];
  const [before, after] =
    axis === 'v'
      ? [fixedAt(site, at - 1, along), fixedAt(site, at, along)]
      : [fixedAt(site, along, at - 1), fixedAt(site, along, at)];
  const ports = (
    fixed: Screen,
    fixedTile: (i: number) => [number, number],
    newTile: (i: number) => [number, number],
  ) => {
    const main = largestComponent(fixed);
    return Array.from({ length }, (_, i) => i).filter((i) => {
      const [tx, ty] = fixedTile(i);
      return main[tileIndex(tx, ty)] && terrainWalkable(site, ...newTile(i));
    });
  };
  if (before) {
    const edge = (i: number): [number, number] =>
      axis === 'v' ? [SCREEN_W - 1, i] : [i, SCREEN_H - 1];
    return ports(before, edge, afterTile);
  }
  if (after) return ports(after, (i) => (axis === 'v' ? [0, i] : [i, 0]), beforeTile);

  const crossable = (i: number) =>
    terrainWalkable(site, ...beforeTile(i)) && terrainWalkable(site, ...afterTile(i));
  const seam = hash4(f.seed, purpose, at, along);
  const tiles: number[] = [];
  let start = -1;
  for (let i = 0; i <= length; i++) {
    if (i < length && crossable(i)) {
      if (start < 0) start = i;
      continue;
    }
    if (start >= 0) {
      const run = i - start;
      const width = Math.min(CROSSING_WIDTH, run);
      const k = start + Math.floor(unit(hash4(seam, start, 0, 0)) * (run - width + 1));
      for (let w = 0; w < width; w++) tiles.push(k + w);
    }
    start = -1;
  }
  return tiles;
}

function crossingsOf(site: Site, sx: number, sy: number): Crossings {
  return {
    n: crossing(site, 'h', sy, sx, SCREEN_W, PURPOSE.crossingH),
    s: crossing(site, 'h', sy + 1, sx, SCREEN_W, PURPOSE.crossingH),
    w: crossing(site, 'v', sx, sy, SCREEN_H, PURPOSE.crossingV),
    e: crossing(site, 'v', sx + 1, sy, SCREEN_H, PURPOSE.crossingV),
  };
}

function tilesOf(x: Crossings): [number, number][] {
  return [
    ...x.n.map((tx): [number, number] => [tx, 0]),
    ...x.s.map((tx): [number, number] => [tx, SCREEN_H - 1]),
    ...x.w.map((ty): [number, number] => [0, ty]),
    ...x.e.map((ty): [number, number] => [SCREEN_W - 1, ty]),
  ];
}

/** Both sides of every seam agree on these, and the screen's repair joins every pocket to one. */
export function crossingTiles(
  world: World,
  coord: ScreenCoord,
  older: Older = NO_OLDER,
): [number, number][] {
  return tilesOf(crossingsOf(siteOf(world, coord, older), coord.sx, coord.sy));
}

function onCrossing(x: Crossings, tx: number, ty: number): boolean {
  return (
    (ty === 0 && x.n.includes(tx)) ||
    (ty === SCREEN_H - 1 && x.s.includes(tx)) ||
    (tx === 0 && x.w.includes(ty)) ||
    (tx === SCREEN_W - 1 && x.e.includes(ty))
  );
}

type Corners = readonly [Terrain, Terrain, Terrain, Terrain];

const GROWS: ReadonlySet<Terrain> = new Set(['grass', 'darkgrass', 'snow']);
const GREEN: ReadonlySet<Terrain> = new Set(['grass', 'darkgrass']);
const SHRUBS: ReadonlySet<Terrain> = new Set([...GROWS, 'sand']);
const DRY: ReadonlySet<Terrain> = new Set(['sand', 'dirt', ...GROWS]);
const BARE: ReadonlySet<Terrain> = new Set(['sand', 'dirt', 'snow']);

type Patch = {
  /** The biome param naming the share of land in this kind of patch. */
  readonly share: 'flowerFields' | 'stands' | 'thickets' | 'rockFields';
  readonly feature: Feature;
  /** Chance, 0..1, that a tile inside the patch holds the feature. */
  readonly fill: number;
  /** Every corner of the tile must be one of these. */
  readonly on: ReadonlySet<Terrain>;
};

/** Sub-patches within a biome; how much land each claims is a biome param. */
const PATCHES: readonly Patch[] = [
  { share: 'stands', feature: 'tree', fill: 0.5, on: GROWS },
  { share: 'thickets', feature: 'bush', fill: 0.45, on: SHRUBS },
  { share: 'rockFields', feature: 'rock', fill: 0.22, on: DRY },
  { share: 'flowerFields', feature: 'flowers', fill: 0.55, on: GREEN },
];

const PATCH_WAVELENGTH = 9;

/** The highest tree chance, which leaves deep woods with gaps to walk through. */
const DEEP_WOODS = 0.62;

/** The chance, 0..1, that a tile here grows a tree. */
function woodsAt(f: LandFields, x: number, y: number, p: BiomeParams, open: number): number {
  return (
    Math.min(DEEP_WOODS, clamp01((threshold(p.woods) - f.forest(x, y)) * 3.5) * p.trees) * open
  );
}

/**
 * How much a tile lies in the band where woods thin out to open land, 0..1: it peaks where the
 * tree chance is EDGE_WOODS and fades out EDGE_WIDTH either side.
 */
function woodsEdge(woods: number): number {
  return clamp01(1 - Math.abs(woods - EDGE_WOODS) / EDGE_WIDTH);
}

const EDGE_WOODS = 0.3;
const EDGE_WIDTH = 0.14;

/**
 * Trees are tested against a clumped value so woods come in stands; everything else rolls on its
 * own, so a small chance still shows. Every density but `bones` comes from the blended biome
 * params; `bones` is the screen biome's own, so a lush screen never shows any.
 */
function featureFor(f: Fields, gtx: number, gty: number, corners: Corners, bones: number): Feature {
  const stamped = stampFeature(f, gtx, gty);
  if (stamped) return stamped;
  const x = gtx + 0.5;
  const y = gty + 0.5;
  const p = f.biome(x, y).params;
  const open = 1 - clearing(f, x, y);
  const all = (on: ReadonlySet<Terrain>) => corners.every((t) => on.has(t));
  const green = all(GREEN);
  const r = unit(hash4(f.seed, PURPOSE.place, gtx, gty));
  const shrub = unit(hash4(f.seed, PURPOSE.shrub, gtx, gty));
  const stand = 0.35 * r + 0.65 * f.clump(x, y);

  const woods = woodsAt(f, x, y, p, open);
  if (all(GROWS) && stand < woods) return 'tree';
  for (let i = 0; i < PATCHES.length; i++) {
    const patch = PATCHES[i]!;
    if (f.patches[i]!(x, y) >= threshold(p[patch.share] * open)) continue;
    if (all(patch.on) && shrub < patch.fill) return patch.feature;
    break;
  }
  const bushChance = 0.015 * p.bushes * open + p.undergrowth * woodsEdge(woods);
  if (all(SHRUBS) && shrub > 1 - bushChance) return 'bush';
  const rockChance = (corners.includes('dirt') ? 0.05 : 0.008) * p.rocks * open;
  if (!corners.includes('water') && r > 1 - rockChance) return 'rock';
  const bone = unit(hash4(f.seed, PURPOSE.bones, gtx, gty));
  if (all(BARE) && bone > 1 - 0.012 * bones * open) return 'bones';
  if (green && f.bloom(x, y) > 0.66 && r > 1 - 0.3 * p.flowers) return 'flowers';
  if (green && r > 1 - 0.08 * p.tallgrass) return 'tallgrass';
  return 'none';
}

/** The terrain at a global lattice point. Screens never change it. */
export function fieldTerrain(world: World, layer: LayerId, gx: number, gy: number): Terrain {
  const f = fieldsOf(world, layer);
  return terrainAt(f, f.network.plan({ x0: gx, y0: gy, x1: gx, y1: gy }), gx, gy);
}

/** The land under a layer's roads, for building a network of its own with `roadNetwork`. */
export function landFor(world: World, layer: LayerId): Land {
  return landOf(fieldsOf(world, layer));
}

export function networkOf(world: World, layer: LayerId): Network {
  return fieldsOf(world, layer).network;
}

/**
 * The biome at a global lattice position, with the land parameters blended from nearby biomes.
 * A pure function of the world seed, layer, and position; stamps do not change it.
 */
export function biomeAt(world: World, layer: LayerId, gx: number, gy: number): BiomeSample {
  return fieldsOf(world, layer).biome(gx, gy);
}

/** The biome sample at a screen's centre, which names the screen's biome and patch. */
export function screenBiome(world: World, { layer, sx, sy }: ScreenCoord): BiomeSample {
  return biomeAt(world, layer, (sx + 0.5) * SCREEN_W, (sy + 0.5) * SCREEN_H);
}

/** The biome the generator records for a screen: a stamp's own, else the fields' at its centre. */
export function biomeOf(world: World, coord: ScreenCoord): Biome {
  const stamp = stampAt(fieldsOf(world, coord.layer), coord.sx, coord.sy);
  return stamp ? stamp.screen.biome : screenBiome(world, coord).biome;
}

type Draft = { coord: ScreenCoord; biome: Biome; corners: Terrain[]; features: Feature[] };

export function generateScreen(world: World, coord: ScreenCoord, older: Older = NO_OLDER): Screen {
  const f = fieldsOf(world, coord.layer);
  const stamp = stampAt(f, coord.sx, coord.sy);
  if (stamp) return stamp.screen;

  const site = siteOf(world, coord, older);
  const x0 = coord.sx * SCREEN_W;
  const y0 = coord.sy * SCREEN_H;
  const corners: Terrain[] = [];
  for (let cy = 0; cy < LATTICE_H; cy++) {
    for (let cx = 0; cx < LATTICE_W; cx++) corners.push(site.terrain(x0 + cx, y0 + cy));
  }
  const { biome } = screenBiome(world, coord);
  const draft: Draft = { coord, biome, corners, features: [] };
  const crossings = crossingsOf(site, coord.sx, coord.sy);
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const gtx = x0 + tx;
      const gty = y0 + ty;
      const corners = tileCorners(draft, tx, ty);
      const mark = site.plan.landmark(gtx, gty);
      const feature = mark
        ? landmarkFor(mark, corners)
        : featureFor(f, gtx, gty, corners, BIOME_PARAMS[biome].bones);
      const clear = mark ? onRoad : reserved;
      const cleared =
        (BLOCKING_FEATURES.has(feature) &&
          (onCrossing(crossings, tx, ty) || clear(site.plan, gtx, gty))) ||
        (isFence(feature) && onEdge(tx, ty));
      draft.features.push(cleared ? 'none' : feature);
    }
  }
  const treeCost = (tx: number, ty: number) =>
    2 + 8 * unit(hash4(f.seed, PURPOSE.carve, x0 + tx, y0 + ty));
  repair(draft, tilesOf(crossings), treeCost);
  return draft;
}

/** Fences keep off a screen's edge tiles, so no fence has to join one on the next screen. */
const onEdge = (tx: number, ty: number) =>
  tx === 0 || ty === 0 || tx === SCREEN_W - 1 || ty === SCREEN_H - 1;

const touches = (gtx: number, gty: number, test: (gx: number, gy: number) => boolean) =>
  CORNER_OFFSETS.some(([dx, dy]) => test(gtx + dx, gty + dy));

/** A tile touching a road or a footprint grows nothing that blocks; a landmark may stand in one. */
function reserved(plan: Plan, gtx: number, gty: number): boolean {
  return touches(gtx, gty, (gx, gy) => plan.road(gx, gy) || plan.ground(gx, gy) !== undefined);
}

/** A landmark gives way to a road, so none blocks one. */
function onRoad(plan: Plan, gtx: number, gty: number): boolean {
  return touches(gtx, gty, plan.road);
}

/** Flowers and grass of a landmark need green ground; what blocks stands anywhere. */
function landmarkFor(mark: Feature, corners: Corners): Feature {
  return BLOCKING_FEATURES.has(mark) || corners.every((t) => GREEN.has(t)) ? mark : 'none';
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function components(screen: Screen): number[] {
  const comp = Array<number>(SCREEN_W * SCREEN_H).fill(-1);
  let next = 0;
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      if (comp[tileIndex(tx, ty)] !== -1 || !isTileWalkable(screen, tx, ty)) continue;
      const stack: [number, number][] = [[tx, ty]];
      comp[tileIndex(tx, ty)] = next;
      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        for (const [sx, sy] of STEPS) {
          const nx = x + sx;
          const ny = y + sy;
          if (!inScreen(nx, ny) || comp[tileIndex(nx, ny)] !== -1) continue;
          if (!isTileWalkable(screen, nx, ny)) continue;
          comp[tileIndex(nx, ny)] = next;
          stack.push([nx, ny]);
        }
      }
      next++;
    }
  }
  return comp;
}

/** Which tiles belong to the screen's biggest walkable region, the land a player moves about on. */
function largestComponent(screen: Screen): boolean[] {
  const comp = components(screen);
  const sizes = new Map<number, number>();
  for (const c of comp) if (c !== -1) sizes.set(c, (sizes.get(c) ?? 0) + 1);
  let main = -1;
  for (const [c, size] of sizes) if (main === -1 || size > sizes.get(main)!) main = c;
  return comp.map((c) => c === main);
}

function waterCorners(draft: Draft, tx: number, ty: number): number {
  return tileCorners(draft, tx, ty).filter((t) => t === 'water').length;
}

type Cost = (tx: number, ty: number) => number;

function stepCost(draft: Draft, treeCost: Cost, tx: number, ty: number): number {
  if (waterCorners(draft, tx, ty) >= 3) return Infinity;
  return BLOCKING_FEATURES.has(draft.features[tileIndex(tx, ty)]!) ? treeCost(tx, ty) : 1;
}

function cheapestPath(
  draft: Draft,
  treeCost: Cost,
  comp: readonly number[],
  from: number,
  targets: ReadonlySet<number>,
): [number, number][] | undefined {
  const dist = Array<number>(SCREEN_W * SCREEN_H).fill(Infinity);
  const prev = Array<number>(SCREEN_W * SCREEN_H).fill(-1);
  const frontier: number[] = [];
  comp.forEach((c, i) => {
    if (c === from) {
      dist[i] = 0;
      frontier.push(i);
    }
  });
  while (frontier.length > 0) {
    frontier.sort((a, b) => dist[b]! - dist[a]!);
    const i = frontier.pop()!;
    if (comp[i] !== from && targets.has(comp[i]!)) {
      const path: [number, number][] = [];
      for (let p = prev[i]!; p !== -1 && comp[p] !== from; p = prev[p]!) {
        path.push([p % SCREEN_W, Math.floor(p / SCREEN_W)]);
      }
      return path;
    }
    const x = i % SCREEN_W;
    const y = Math.floor(i / SCREEN_W);
    for (const [sx, sy] of STEPS) {
      const nx = x + sx;
      const ny = y + sy;
      if (!inScreen(nx, ny)) continue;
      const ni = tileIndex(nx, ny);
      const nd = dist[i]! + stepCost(draft, treeCost, nx, ny);
      if (nd < dist[ni]!) {
        if (dist[ni] === Infinity) frontier.push(ni);
        dist[ni] = nd;
        prev[ni] = i;
      }
    }
  }
  return undefined;
}

function crossingComponents(comp: readonly number[], crossings: readonly [number, number][]) {
  const ids = new Set<number>();
  for (const [tx, ty] of crossings) {
    const c = comp[tileIndex(tx, ty)]!;
    if (c !== -1) ids.add(c);
  }
  return ids;
}

/**
 * Water and shared lattice points never change: land is connected across the whole world by
 * construction, so each crossing already leads somewhere. Crossings are joined to each other
 * first, then every walkable pocket is joined to a crossing, so no walkable tile is out of reach.
 * Other walkable edge tiles stay as they are; a player can only step onto one straight from a
 * walkable tile, and can step straight back. A sliver of shore that water shuts off from every
 * crossing, as between two lobes of a lake, gets rocks instead.
 */
function repair(draft: Draft, crossings: readonly [number, number][], treeCost: Cost): void {
  for (;;) {
    const comp = components(draft);
    const ids = crossingComponents(comp, crossings);
    const byId = (a: number, b: number) => a - b;
    const pockets = [...new Set(comp)].filter((c) => c !== -1 && !ids.has(c));
    let joined = false;
    for (const from of [...(ids.size > 1 ? [...ids].sort(byId) : []), ...pockets.sort(byId)]) {
      const path = cheapestPath(draft, treeCost, comp, from, ids);
      if (!path) continue;
      for (const [tx, ty] of path) draft.features[tileIndex(tx, ty)] = 'none';
      joined = true;
      break;
    }
    if (!joined) {
      if (ids.size > 0) {
        for (let i = 0; i < comp.length; i++) {
          if (pockets.includes(comp[i]!)) draft.features[i] = 'rock';
        }
      }
      return;
    }
  }
}
