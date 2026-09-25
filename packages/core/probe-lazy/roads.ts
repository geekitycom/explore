import { cellMemo } from './biome.ts';
import { fbm, hash4 } from './noise.ts';
import {
  REGION_H,
  REGION_W,
  inFootprint,
  holdsLandmark,
  landmarkAt,
  poiIn,
  regionOf,
  type Land,
  type Poi,
  type PoiRegion,
} from './poi.ts';
import { SCREEN_H, SCREEN_W, type Feature, type Terrain } from './world.ts';

export type Point = { readonly x: number; readonly y: number };

/** A box in global lattice units, edges included. */
export type Box = {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
};

/** A road between two points of interest, as a polyline in global lattice units. */
export type Road = { readonly a: Poi; readonly b: Poi; readonly path: readonly Point[] };

/** What the network fixes on the lattice points of one box. */
export type Plan = {
  readonly road: (gx: number, gy: number) => boolean;
  /** The ground a point of interest flattens this point to, if it lies in a footprint. */
  readonly ground: (gx: number, gy: number) => Terrain | undefined;
  /** The landmark feature standing on a global tile, if any. */
  readonly landmark: (gtx: number, gty: number) => Feature | undefined;
};

export type Network = {
  readonly poisIn: (box: Box) => Poi[];
  readonly roadsIn: (box: Box) => Road[];
  readonly plan: (box: Box) => Plan;
};

/** Roads are routed on a grid of CELL-point cells, then smoothed. */
const CELL = 5;
/** How many cells a route may stray outside the box around its ends. */
const DETOUR = 6;
/** How far a road runs straight out of a fixed exit before it turns. */
const STUB = 8;
/** Lattice points this close to a road's centre line are road: three or four points wide. */
export const ROAD_RADIUS = 1.5;
const COST = { water: 30, ford: 10, shore: 2, woods: 3, meander: 3 } as const;
/** Roads join points at most this many regions apart. */
const LINK = 1;
/** Enough regions to hold every point that could stand between two linked points. */
const WITNESS = 3;
const SQRT2 = Math.SQRT2;

const PURPOSE = { meander: 20 } as const;

type End = { readonly poi: Poi; readonly port: number };
type Link = { readonly key: string; readonly a: End; readonly b: End; readonly corridor: Box };

const idOf = ({ region }: Poi) => `${region.rx},${region.ry}`;
const order = (p: Poi, q: Poi) => p.region.ry - q.region.ry || p.region.rx - q.region.rx;
const distance = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);

function regionsAround({ rx, ry }: PoiRegion, r: number): PoiRegion[] {
  const out: PoiRegion[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++)
      if (dx !== 0 || dy !== 0) out.push({ rx: rx + dx, ry: ry + dy });
  }
  return out;
}

function regionsIn(box: Box, padX: number, padY: number): PoiRegion[] {
  const lo = regionOf(box.x0 - padX, box.y0 - padY);
  const hi = regionOf(box.x1 + padX, box.y1 + padY);
  const out: PoiRegion[] = [];
  for (let ry = lo.ry; ry <= hi.ry; ry++)
    for (let rx = lo.rx; rx <= hi.rx; rx++) out.push({ rx, ry });
  return out;
}

const overlaps = (a: Box, b: Box) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;

function portOf({ poi, port }: End): Point {
  return poi.ports[port]!;
}

/** Where routing starts: a fixed exit's road first runs STUB points straight out. */
function anchorOf(end: End): Point {
  const port = end.poi.ports[end.port]!;
  return port.out ? { x: port.x + port.out.dx * STUB, y: port.y + port.out.dy * STUB } : port;
}

/** The port of `p` that faces `q` best. */
function portToward(p: Poi, q: Point): number {
  let best = 0;
  let bestScore = -Infinity;
  p.ports.forEach((port, i) => {
    const d = distance(port, q) || 1;
    const score = port.out ? (port.out.dx * (q.x - port.x) + port.out.dy * (q.y - port.y)) / d : 0;
    if (score > bestScore) [best, bestScore] = [i, score];
  });
  return best;
}

const cellOf = (p: Point): [number, number] => [Math.floor(p.x / CELL), Math.floor(p.y / CELL)];
const centreOf = (i: number, j: number): Point => ({ x: (i + 0.5) * CELL, y: (j + 0.5) * CELL });

function linkOf(p: End, q: End): Link {
  const [a, b] = order(p.poi, q.poi) < 0 ? [p, q] : [q, p];
  const [ai, aj] = cellOf(anchorOf(a));
  const [bi, bj] = cellOf(anchorOf(b));
  return {
    key: `${idOf(a.poi)}/${a.port}-${idOf(b.poi)}/${b.port}`,
    a,
    b,
    corridor: {
      x0: (Math.min(ai, bi) - DETOUR) * CELL,
      y0: (Math.min(aj, bj) - DETOUR) * CELL,
      x1: (Math.max(ai, bi) + DETOUR + 1) * CELL,
      y1: (Math.max(aj, bj) + DETOUR + 1) * CELL,
    },
  };
}

/** A binary min-heap of grid indices keyed by priority, ties broken by index. */
class Heap {
  readonly #keys: number[] = [];
  readonly #items: number[] = [];

  get size(): number {
    return this.#items.length;
  }

  push(item: number, key: number): void {
    this.#items.push(item);
    this.#keys.push(key);
    let i = this.#items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.#less(i, parent)) break;
      this.#swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.#items[0]!;
    const lastItem = this.#items.pop()!;
    const lastKey = this.#keys.pop()!;
    if (this.#items.length > 0) {
      this.#items[0] = lastItem;
      this.#keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.#items.length && this.#less(l, m)) m = l;
        if (r < this.#items.length && this.#less(r, m)) m = r;
        if (m === i) break;
        this.#swap(i, m);
        i = m;
      }
    }
    return top;
  }

  #less(a: number, b: number): boolean {
    const ka = this.#keys[a]!;
    const kb = this.#keys[b]!;
    return ka < kb || (ka === kb && this.#items[a]! < this.#items[b]!);
  }

  #swap(a: number, b: number): void {
    [this.#items[a], this.#items[b]] = [this.#items[b]!, this.#items[a]!];
    [this.#keys[a], this.#keys[b]] = [this.#keys[b]!, this.#keys[a]!];
  }
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * The cheapest 8-connected run of cells from `from` to `to` within DETOUR cells of the box
 * around them. Diagonal steps may not cut past an impassable cell. Undefined if walled off.
 */
function cheapestCells(
  cost: (i: number, j: number) => number,
  [fi, fj]: [number, number],
  [ti, tj]: [number, number],
): [number, number][] | undefined {
  const i0 = Math.min(fi, ti) - DETOUR;
  const j0 = Math.min(fj, tj) - DETOUR;
  const w = Math.abs(fi - ti) + 1 + 2 * DETOUR;
  const h = Math.abs(fj - tj) + 1 + 2 * DETOUR;
  const g = new Float64Array(w * h).fill(Infinity);
  const prev = new Int32Array(w * h).fill(-1);
  const done = new Uint8Array(w * h);
  const costs = new Float64Array(w * h).fill(-1);
  const costAt = (x: number, y: number) => {
    const k = y * w + x;
    if (costs[k]! < 0) costs[k] = cost(i0 + x, j0 + y);
    return costs[k]!;
  };
  const guess = (x: number, y: number) => {
    const dx = Math.abs(x - (ti - i0));
    const dy = Math.abs(y - (tj - j0));
    return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
  };
  const start = (fj - j0) * w + (fi - i0);
  const goal = (tj - j0) * w + (ti - i0);
  const open = new Heap();
  g[start] = 0;
  open.push(start, guess(fi - i0, fj - j0));
  while (open.size > 0) {
    const k = open.pop();
    if (done[k]) continue;
    done[k] = 1;
    if (k === goal) {
      const cells: [number, number][] = [];
      for (let c = k; c !== -1; c = prev[c]!) cells.push([i0 + (c % w), j0 + Math.floor(c / w)]);
      return cells.reverse();
    }
    const x = k % w;
    const y = Math.floor(k / w);
    for (const [dx, dy] of STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const n = ny * w + nx;
      if (done[n]) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (costAt(nx, y) === Infinity || costAt(x, ny) === Infinity)) continue;
      const step = costAt(nx, ny) * (diagonal ? SQRT2 : 1);
      if (step === Infinity) continue;
      const next = g[k]! + step;
      if (next < g[n]!) {
        g[n] = next;
        prev[n] = k;
        open.push(n, next + guess(nx, ny));
      }
    }
  }
  return undefined;
}

/** Chaikin corner cutting, keeping both ends. */
function smoothed(points: readonly Point[], rounds: number): Point[] {
  let pts = [...points];
  for (let r = 0; r < rounds && pts.length > 2; r++) {
    const next: Point[] = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i]!;
      const q = pts[i + 1]!;
      if (i > 0) next.push({ x: 0.75 * p.x + 0.25 * q.x, y: 0.75 * p.y + 0.25 * q.y });
      if (i < pts.length - 2) next.push({ x: 0.25 * p.x + 0.75 * q.x, y: 0.25 * p.y + 0.75 * q.y });
    }
    next.push(pts[pts.length - 1]!);
    pts = next;
  }
  return pts;
}

function distanceSqToSegment(px: number, py: number, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.min(1, Math.max(0, ((px - a.x) * dx + (py - a.y) * dy) / len));
  const x = a.x + t * dx - px;
  const y = a.y + t * dy - py;
  return x * x + y * y;
}

/**
 * The roads and points of interest of one layer. Every answer is a pure function of the land:
 * points come one per region, roads join the relative neighbourhood graph of nearby points (plus
 * a road for any fixed exit left without one), and each road is routed on its own, so any screen,
 * in any order, sees the same network. Results are cached, which only saves time.
 */
export function roadNetwork(land: Land): Network {
  const poiAt = cellMemo((rx, ry) => poiIn(land, { rx, ry }));
  const poiOf = (r: PoiRegion) => poiAt(r.rx, r.ry);

  const meander = fbm(hash4(land.seed, PURPOSE.meander, 0, 0), { wavelength: 5, octaves: 2 });
  const cost = cellMemo((i, j) => {
    const { x, y } = centreOf(i, j);
    const inStamp = land.stamps.some(({ coord }) => {
      const x0 = coord.sx * SCREEN_W;
      const y0 = coord.sy * SCREEN_H;
      return x >= x0 - 1 && x <= x0 + SCREEN_W + 1 && y >= y0 - 1 && y <= y0 + SCREEN_H + 1;
    });
    if (inStamp) return Infinity;
    let depth = -Infinity;
    let lake = false;
    let river = false;
    for (const [dx, dy] of [
      [0, 0],
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
    ] as const) {
      const wet = land.waterDepth(x + dx, y + dy);
      const ford = wet > 0 && land.riverDepth(x + dx, y + dy) > 0;
      depth = Math.max(depth, wet);
      lake ||= wet > 0 && !ford;
      river ||= ford;
    }
    if (lake) return COST.water;
    if (river) return COST.ford;
    const ground = depth > -3 ? COST.shore : 1;
    const hills = Math.min(1, Math.max(0, (meander(i, j) - 0.3) / 0.4));
    return ground + COST.woods * land.woods(x, y) + COST.meander * hills;
  });

  /** Relative neighbourhood graph: pq is kept unless some other point is nearer to both. */
  const joined = (p: Poi, q: Poi) => {
    const d = distance(p, q);
    return regionsAround(p.region, WITNESS).every((r) => {
      const w = poiOf(r);
      return w === q || Math.max(distance(p, w), distance(q, w)) >= d;
    });
  };

  const linksOf = cellMemo((rx, ry): Link[] => {
    const p = poiAt(rx, ry);
    const near = regionsAround(p.region, LINK).map(poiOf);
    const links = near
      .filter((q) => joined(p, q))
      .map((q) => linkOf({ poi: p, port: portToward(p, q) }, { poi: q, port: portToward(q, p) }));
    p.ports.forEach((port, i) => {
      if (!port.out || links.some((l) => (l.a.poi === p ? l.a : l.b).port === i)) return;
      let best: Poi | undefined;
      let bestScore = Infinity;
      for (const q of near) {
        const d = distance(port, q);
        const facing = (port.out.dx * (q.x - port.x) + port.out.dy * (q.y - port.y)) / d;
        if (facing > 0.3 && d / facing < bestScore) [best, bestScore] = [q, d / facing];
      }
      if (best) links.push(linkOf({ poi: p, port: i }, { poi: best, port: portToward(best, p) }));
    });
    return links;
  });

  const routes = new Map<string, Road>();
  const routeOf = (link: Link): Road => {
    let road = routes.get(link.key);
    if (road) return road;
    const from = anchorOf(link.a);
    const to = anchorOf(link.b);
    const cells = cheapestCells(cost, cellOf(from), cellOf(to)) ?? [];
    const middle = cells.slice(1, -1).map(([i, j]) => centreOf(i, j));
    const path = [portOf(link.a), ...smoothed([from, ...middle, to], 3), portOf(link.b)];
    road = { a: link.a.poi, b: link.b.poi, path };
    routes.set(link.key, road);
    return road;
  };

  // A link's corridor stays within two regions and a detour of its ends.
  const linkPadX = 2 * REGION_W + (DETOUR + 1) * CELL + STUB + SCREEN_W;
  const linkPadY = 2 * REGION_H + (DETOUR + 1) * CELL + STUB + SCREEN_H;

  const roadsIn = (box: Box): Road[] => {
    const found = new Map<string, Link>();
    for (const r of regionsIn(box, linkPadX, linkPadY)) {
      for (const link of linksOf(r.rx, r.ry)) {
        if (overlaps(link.corridor, box)) found.set(link.key, link);
      }
    }
    return [...found.keys()].sort().map((key) => routeOf(found.get(key)!));
  };

  const poisIn = (box: Box): Poi[] =>
    regionsIn(box, SCREEN_W, SCREEN_H)
      .map(poiOf)
      .filter((p) =>
        overlaps(box, {
          x0: p.x - p.reach[0],
          y0: p.y - p.reach[1],
          x1: p.x + p.reach[0],
          y1: p.y + p.reach[1],
        }),
      );

  const plan = (box: Box): Plan => {
    const padded = {
      x0: box.x0 - ROAD_RADIUS,
      y0: box.y0 - ROAD_RADIUS,
      x1: box.x1 + ROAD_RADIUS,
      y1: box.y1 + ROAD_RADIUS,
    };
    const segments: [Point, Point][] = [];
    for (const { path } of roadsIn(box)) {
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i]!;
        const b = path[i + 1]!;
        const bounds = {
          x0: Math.min(a.x, b.x),
          y0: Math.min(a.y, b.y),
          x1: Math.max(a.x, b.x),
          y1: Math.max(a.y, b.y),
        };
        if (overlaps(bounds, padded)) segments.push([a, b]);
      }
    }
    const pois = poisIn(box);
    const r2 = ROAD_RADIUS * ROAD_RADIUS;
    return {
      road: (gx, gy) =>
        segments.some(([a, b]) => distanceSqToSegment(gx, gy, a, b) <= r2) &&
        !pois.some((p) => holdsLandmark(p, gx, gy)),
      ground: (gx, gy) => pois.find((p) => inFootprint(p, gx, gy))?.ground,
      landmark: (gtx, gty) => {
        for (const p of pois) {
          const feature = landmarkAt(p, gtx, gty);
          if (feature) return feature;
        }
        return undefined;
      },
    };
  };

  return { poisIn, roadsIn, plan };
}
