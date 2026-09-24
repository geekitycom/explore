import { createRng, type Rng } from './rng.ts';
import { isTileWalkable } from './walk.ts';
import {
  BLOCKING_FEATURES,
  LATTICE_H,
  LATTICE_W,
  SCREEN_H,
  SCREEN_W,
  cornerAt,
  cornerIndex,
  featureAt,
  tileIndex,
  type Feature,
  type Screen,
  type ScreenCoord,
  type Terrain,
} from './world.ts';

export const NEIGHBOR_OFFSETS = {
  n: { dx: 0, dy: -1 },
  ne: { dx: 1, dy: -1 },
  e: { dx: 1, dy: 0 },
  se: { dx: 1, dy: 1 },
  s: { dx: 0, dy: 1 },
  sw: { dx: -1, dy: 1 },
  w: { dx: -1, dy: 0 },
  nw: { dx: -1, dy: -1 },
} as const;

export type NeighborDir = keyof typeof NEIGHBOR_OFFSETS;
export type Neighbors = Partial<Record<NeighborDir, Screen>>;

const NEIGHBOR_DIRS = Object.keys(NEIGHBOR_OFFSETS) as NeighborDir[];
/** Edge neighbors in the order that wins a corner tile both of them want to fix. */
const EDGE_DIRS = ['n', 's', 'w', 'e'] as const;

const HEIGHT_TARGET: Record<Terrain, number> = { water: 0.12, sand: 0.31, dirt: 0.56, grass: 0.56 };
const WATER_BELOW = 0.28;
const SAND_BELOW = 0.34;
const DIRT_ABOVE = 0.7;
const INFLUENCE_FALLOFF = 2.5;

type Point = { x: number; y: number; value: number };

/** A screen under construction. `fixed*` cells came from neighbors and are never changed. */
type Draft = {
  corners: Terrain[];
  features: Feature[];
  fixedCorner: boolean[];
  fixedFeature: boolean[];
};

export function generateScreen(coord: ScreenCoord, seed: number, neighbors: Neighbors): Screen {
  const rng = createRng(seed);
  const draft: Draft = {
    corners: Array<Terrain>(LATTICE_W * LATTICE_H).fill('grass'),
    features: Array<Feature>(SCREEN_W * SCREEN_H).fill('none'),
    fixedCorner: Array<boolean>(LATTICE_W * LATTICE_H).fill(false),
    fixedFeature: Array<boolean>(SCREEN_W * SCREEN_H).fill(false),
  };

  copyNeighborLattice(draft, neighbors);
  copyNeighborEdgeFeatures(draft, neighbors);
  fillTerrain(draft, rng);
  fillFeatures(draft, rng);
  mirrorEdgeWalkability(draft, neighbors);
  openFreeEdges(draft, neighbors, rng);
  connectEdges(draft);

  return { coord, seed, corners: draft.corners, features: draft.features };
}

function copyNeighborLattice(draft: Draft, neighbors: Neighbors): void {
  for (const dir of NEIGHBOR_DIRS) {
    const other = neighbors[dir];
    if (!other) continue;
    const { dx, dy } = NEIGHBOR_OFFSETS[dir];
    for (let cy = 0; cy < LATTICE_H; cy++) {
      for (let cx = 0; cx < LATTICE_W; cx++) {
        const ox = cx - dx * SCREEN_W;
        const oy = cy - dy * SCREEN_H;
        if (ox < 0 || oy < 0 || ox >= LATTICE_W || oy >= LATTICE_H) continue;
        const i = cornerIndex(cx, cy);
        draft.corners[i] = cornerAt(other, ox, oy);
        draft.fixedCorner[i] = true;
      }
    }
  }
}

function edgeTiles(dir: (typeof EDGE_DIRS)[number]): [number, number][] {
  switch (dir) {
    case 'n':
      return Array.from({ length: SCREEN_W }, (_, x) => [x, 0]);
    case 's':
      return Array.from({ length: SCREEN_W }, (_, x) => [x, SCREEN_H - 1]);
    case 'w':
      return Array.from({ length: SCREEN_H }, (_, y) => [0, y]);
    case 'e':
      return Array.from({ length: SCREEN_H }, (_, y) => [SCREEN_W - 1, y]);
  }
}

/** The neighbor's tile that sits across the seam from our edge tile (tx, ty). */
function facingTile(dir: (typeof EDGE_DIRS)[number], tx: number, ty: number): [number, number] {
  const { dx, dy } = NEIGHBOR_OFFSETS[dir];
  return [tx - dx * (SCREEN_W - 1), ty - dy * (SCREEN_H - 1)];
}

function isCornerTile(tx: number, ty: number): boolean {
  return (tx === 0 || tx === SCREEN_W - 1) && (ty === 0 || ty === SCREEN_H - 1);
}

function copyNeighborEdgeFeatures(draft: Draft, neighbors: Neighbors): void {
  for (const dir of EDGE_DIRS) {
    const other = neighbors[dir];
    if (!other) continue;
    for (const [tx, ty] of edgeTiles(dir)) {
      const i = tileIndex(tx, ty);
      if (draft.fixedFeature[i]) continue;
      draft.features[i] = featureAt(other, ...facingTile(dir, tx, ty));
      draft.fixedFeature[i] = true;
    }
  }
}

/** Two octaves of smoothed value noise over lattice coordinates, in [0, 1]. */
function noiseField(rng: Rng, cell: number, detail = 0.3): (x: number, y: number) => number {
  const octave = (size: number) => {
    const w = Math.ceil(LATTICE_W / size) + 2;
    const h = Math.ceil(LATTICE_H / size) + 2;
    const grid = Array.from({ length: w * h }, rng);
    const at = (gx: number, gy: number) => grid[gy * w + gx]!;
    const smooth = (t: number) => t * t * (3 - 2 * t);
    return (x: number, y: number) => {
      const gx = Math.floor(x / size);
      const gy = Math.floor(y / size);
      const fx = smooth(x / size - gx);
      const fy = smooth(y / size - gy);
      const top = at(gx, gy) + (at(gx + 1, gy) - at(gx, gy)) * fx;
      const bottom = at(gx, gy + 1) + (at(gx + 1, gy + 1) - at(gx, gy + 1)) * fx;
      return top + (bottom - top) * fy;
    };
  };
  const coarse = octave(cell);
  const fine = octave(cell / 2);
  return (x, y) => (1 - detail) * coarse(x, y) + detail * fine(x, y);
}

/**
 * Pulls a free-running value toward what nearby fixed points imply, fading out with distance
 * so a seam blends into the screen's own character a few tiles in.
 */
function blendTowardFixed(x: number, y: number, own: number, fixed: readonly Point[]): number {
  if (fixed.length === 0) return own;
  let minDist = Infinity;
  let weighted = 0;
  let weights = 0;
  for (const p of fixed) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
    minDist = Math.min(minDist, Math.sqrt(d2));
    weighted += p.value / d2;
    weights += 1 / d2;
  }
  const influence = Math.exp(-minDist / INFLUENCE_FALLOFF);
  return influence * (weighted / weights) + (1 - influence) * own;
}

function fillTerrain(draft: Draft, rng: Rng): void {
  const height = noiseField(rng, 10, 0.2);
  const dirtiness = noiseField(rng, 7, 0.25);
  const lake = rng() < 0.3 ? 0.12 + rng() * 0.12 : 0;
  const dirtBias = (rng() - 0.5) * 0.2;

  const fixedHeight: Point[] = [];
  const fixedDirt: Point[] = [];
  for (let cy = 0; cy < LATTICE_H; cy++) {
    for (let cx = 0; cx < LATTICE_W; cx++) {
      const i = cornerIndex(cx, cy);
      if (!draft.fixedCorner[i]) continue;
      const t = draft.corners[i]!;
      fixedHeight.push({ x: cx, y: cy, value: HEIGHT_TARGET[t] });
      fixedDirt.push({ x: cx, y: cy, value: t === 'dirt' ? 0.85 : 0.45 });
    }
  }

  for (let cy = 0; cy < LATTICE_H; cy++) {
    for (let cx = 0; cx < LATTICE_W; cx++) {
      const i = cornerIndex(cx, cy);
      if (draft.fixedCorner[i]) continue;
      const h = blendTowardFixed(cx, cy, height(cx, cy) - lake, fixedHeight);
      const d = blendTowardFixed(cx, cy, dirtiness(cx, cy) + dirtBias, fixedDirt);
      draft.corners[i] =
        h < WATER_BELOW ? 'water' : h < SAND_BELOW ? 'sand' : d > DIRT_ABOVE ? 'dirt' : 'grass';
    }
  }
}

function fillFeatures(draft: Draft, rng: Rng): void {
  const density = noiseField(rng, 7, 0.25);
  const blooms = noiseField(rng, 3);
  const forest = rng() ** 1.3;

  const fixedTrees: Point[] = [];
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const i = tileIndex(tx, ty);
      if (!draft.fixedFeature[i]) continue;
      const f = draft.features[i]!;
      fixedTrees.push({ x: tx, y: ty, value: f === 'tree' || f === 'bush' ? 0.85 : 0.35 });
    }
  }

  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const i = tileIndex(tx, ty);
      if (draft.fixedFeature[i]) continue;
      const corners = [
        draft.corners[cornerIndex(tx, ty)]!,
        draft.corners[cornerIndex(tx + 1, ty)]!,
        draft.corners[cornerIndex(tx, ty + 1)]!,
        draft.corners[cornerIndex(tx + 1, ty + 1)]!,
      ];
      const lx = tx + 0.5;
      const ly = ty + 0.5;
      const d = blendTowardFixed(tx, ty, 0.6 * density(lx, ly) + 0.4 * forest, fixedTrees);
      const treeChance = Math.min(0.9, Math.max(0, (d - 0.48) * 3.2));
      const allGrass = corners.every((t) => t === 'grass');
      const hasWater = corners.includes('water');
      const r = rng();

      let feature: Feature = 'none';
      if (allGrass && r < treeChance) feature = 'tree';
      else if (allGrass && r < treeChance + 0.03 + 0.15 * treeChance) feature = 'bush';
      else if (!hasWater && r > 0.975) feature = 'rock';
      else if (allGrass && blooms(lx, ly) > 0.66 && r > 0.45) feature = 'flowers';
      else if (allGrass && r > 0.92) feature = 'tallgrass';
      draft.features[i] = feature;
    }
  }
}

function draftScreen(draft: Draft): Screen {
  return { coord: { sx: 0, sy: 0 }, seed: 0, corners: draft.corners, features: draft.features };
}

function walkable(draft: Draft, tx: number, ty: number): boolean {
  return isTileWalkable(draftScreen(draft), tx, ty);
}

function tileCornerIndexes(tx: number, ty: number): number[] {
  return [
    cornerIndex(tx, ty),
    cornerIndex(tx + 1, ty),
    cornerIndex(tx, ty + 1),
    cornerIndex(tx + 1, ty + 1),
  ];
}

/** Whether carving could make the tile walkable without touching fixed cells. */
function carvable(draft: Draft, tx: number, ty: number): boolean {
  const i = tileIndex(tx, ty);
  if (draft.fixedFeature[i] && BLOCKING_FEATURES.has(draft.features[i]!)) return false;
  const fixedWater = tileCornerIndexes(tx, ty).filter(
    (c) => draft.fixedCorner[c] && draft.corners[c] === 'water',
  ).length;
  return fixedWater < 3;
}

function carve(draft: Draft, tx: number, ty: number): void {
  const i = tileIndex(tx, ty);
  if (!draft.fixedFeature[i] && BLOCKING_FEATURES.has(draft.features[i]!)) {
    draft.features[i] = 'none';
  }
  for (const c of tileCornerIndexes(tx, ty)) {
    if (!draft.fixedCorner[c] && draft.corners[c] === 'water') draft.corners[c] = 'sand';
  }
}

/** If you can stand at the neighbor's edge, you can stand across the seam. */
function mirrorEdgeWalkability(draft: Draft, neighbors: Neighbors): void {
  for (const dir of EDGE_DIRS) {
    const other = neighbors[dir];
    if (!other) continue;
    for (const [tx, ty] of edgeTiles(dir)) {
      if (isCornerTile(tx, ty)) continue;
      const [ox, oy] = facingTile(dir, tx, ty);
      if (isTileWalkable(other, ox, oy) && !walkable(draft, tx, ty) && carvable(draft, tx, ty)) {
        carve(draft, tx, ty);
      }
    }
  }
}

function openFreeEdges(draft: Draft, neighbors: Neighbors, rng: Rng): void {
  for (const dir of EDGE_DIRS) {
    if (neighbors[dir]) continue;
    const tiles = edgeTiles(dir);
    if (tiles.some(([tx, ty]) => walkable(draft, tx, ty))) continue;
    const start = 1 + Math.floor(rng() * (tiles.length - 3));
    for (const [tx, ty] of tiles.slice(start, start + 2)) {
      if (carvable(draft, tx, ty)) carve(draft, tx, ty);
    }
  }
}

function isEdgeTile(tx: number, ty: number): boolean {
  return tx === 0 || ty === 0 || tx === SCREEN_W - 1 || ty === SCREEN_H - 1;
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

function inBounds(tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < SCREEN_W && ty < SCREEN_H;
}

/** Component id per tile for walkable tiles, -1 for blocked. */
function components(draft: Draft): number[] {
  const comp = Array<number>(SCREEN_W * SCREEN_H).fill(-1);
  let next = 0;
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      if (comp[tileIndex(tx, ty)] !== -1 || !walkable(draft, tx, ty)) continue;
      const stack: [number, number][] = [[tx, ty]];
      comp[tileIndex(tx, ty)] = next;
      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        for (const [sx, sy] of STEPS) {
          const nx = x + sx;
          const ny = y + sy;
          if (!inBounds(nx, ny) || comp[tileIndex(nx, ny)] !== -1 || !walkable(draft, nx, ny)) {
            continue;
          }
          comp[tileIndex(nx, ny)] = next;
          stack.push([nx, ny]);
        }
      }
      next++;
    }
  }
  return comp;
}

function edgeComponentCounts(comp: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const c = comp[tileIndex(tx, ty)]!;
      if (c !== -1 && isEdgeTile(tx, ty)) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return counts;
}

function carveCost(draft: Draft, tx: number, ty: number): number {
  if (walkable(draft, tx, ty)) return 1;
  if (!carvable(draft, tx, ty)) return Infinity;
  const blockedByFeature = BLOCKING_FEATURES.has(draft.features[tileIndex(tx, ty)]!);
  const water = tileCornerIndexes(tx, ty).filter((c) => draft.corners[c] === 'water').length;
  return 1 + (blockedByFeature ? 4 : 0) + (water >= 3 ? 8 : 0);
}

/** Cheapest carve path from any tile of `from` to any tile of `to`, excluding both ends. */
function cheapestPath(draft: Draft, comp: readonly number[], from: number, to: number) {
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
    if (comp[i] === to) {
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
      if (!inBounds(nx, ny)) continue;
      const ni = tileIndex(nx, ny);
      const nd = dist[i]! + carveCost(draft, nx, ny);
      if (nd < dist[ni]!) {
        if (dist[ni] === Infinity) frontier.push(ni);
        dist[ni] = nd;
        prev[ni] = i;
      }
    }
  }
  return undefined;
}

/** Joins every walkable edge tile into one component so no screen can trap a player. */
function connectEdges(draft: Draft): void {
  for (;;) {
    const comp = components(draft);
    const counts = [...edgeComponentCounts(comp)].sort((a, b) => b[1] - a[1]);
    if (counts.length <= 1) return;
    const main = counts[0]![0];
    let joined = false;
    for (const [other] of counts.slice(1)) {
      const path = cheapestPath(draft, comp, other, main);
      if (!path) continue;
      for (const [tx, ty] of path) carve(draft, tx, ty);
      joined = true;
      break;
    }
    if (!joined) return;
  }
}

export function neighborsOf(
  { sx, sy }: ScreenCoord,
  lookup: (coord: ScreenCoord) => Screen | undefined,
): Neighbors {
  const neighbors: Neighbors = {};
  for (const dir of NEIGHBOR_DIRS) {
    const { dx, dy } = NEIGHBOR_OFFSETS[dir];
    const screen = lookup({ sx: sx + dx, sy: sy + dy });
    if (screen) neighbors[dir] = screen;
  }
  return neighbors;
}
