import type { Place } from './place.ts';
import type { Point } from './roads.ts';
import { FEET, canOccupy, isWalkable } from './walk.ts';
import {
  SCREEN_H,
  SCREEN_PX_H,
  SCREEN_PX_W,
  SCREEN_W,
  TILE,
  inScreen,
  tileIndex,
} from './world.ts';

const BOX_DROP = (FEET.up - FEET.down) / 2;

const clampTile = (v: number, size: number) => Math.min(Math.max(Math.floor(v), 0), size - 1);

/** The tile under the centre of the feet box at `p`, pulled onto the screen. */
const tileUnder = (p: Point) => ({
  tx: clampTile(p.x / TILE, SCREEN_W),
  ty: clampTile((p.y - BOX_DROP) / TILE, SCREEN_H),
});

/** The feet position that centres the feet box on tile (tx, ty). */
const tileCentre = (tx: number, ty: number): Point => ({
  x: tx * TILE + TILE / 2,
  y: ty * TILE + TILE / 2 + BOX_DROP,
});

/**
 * How far a straight line keeps the feet box from every blocked tile. A frame's step along the
 * line moves under 1px per axis at 60fps, so the L-shaped move `canWalk` checks, as the server
 * does, stays clear too.
 */
const MARGIN_PX = 1;

/** Whether the line from `p` along `d` for t in [0, 1] enters the open box lo..hi. */
function hitsOpenBox(p: Point, d: Point, lo: Point, hi: Point): boolean {
  let enter = 0;
  let leave = 1;
  for (const axis of ['x', 'y'] as const) {
    if (d[axis] === 0) {
      if (p[axis] <= lo[axis] || p[axis] >= hi[axis]) return false;
      continue;
    }
    const t1 = (lo[axis] - p[axis]) / d[axis];
    const t2 = (hi[axis] - p[axis]) / d[axis];
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
  }
  return enter < leave;
}

/** Whether the feet box swept straight from `a` to `b` stays off every blocked tile, with margin. */
function clearLine(place: Place, a: Point, b: Point): boolean {
  if (!canOccupy(place, b.x, b.y)) return false;
  const reachX = FEET.halfW + MARGIN_PX;
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const d = { x: b.x - a.x, y: b.y - a.y };
  for (
    let ty = Math.floor((y0 - FEET.up - MARGIN_PX) / TILE);
    ty <= (y1 + FEET.down + MARGIN_PX) / TILE;
    ty++
  ) {
    for (let tx = Math.floor((x0 - reachX) / TILE); tx <= (x1 + reachX) / TILE; tx++) {
      if (!inScreen(tx, ty) || isWalkable(place, tx, ty)) continue;
      const lo = { x: tx * TILE - reachX, y: ty * TILE - FEET.down - MARGIN_PX };
      const hi = { x: (tx + 1) * TILE + reachX, y: (ty + 1) * TILE + FEET.up + MARGIN_PX };
      if (hitsOpenBox(a, d, lo, hi)) return false;
    }
  }
  return true;
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
 * Shortest tile paths from `start` to every reachable tile, moving in 8 directions. A diagonal
 * needs both tiles beside it walkable, so the feet box never clips a blocked corner.
 */
function flood(place: Place, start: { tx: number; ty: number }) {
  const cost = new Array<number>(SCREEN_W * SCREEN_H).fill(Infinity);
  const from = new Array<number>(SCREEN_W * SCREEN_H).fill(-1);
  const done = new Array<boolean>(SCREEN_W * SCREEN_H).fill(false);
  cost[tileIndex(start.tx, start.ty)] = 0;
  for (;;) {
    let at = -1;
    for (let i = 0; i < cost.length; i++)
      if (!done[i] && cost[i]! < Infinity && (at < 0 || cost[i]! < cost[at]!)) at = i;
    if (at < 0) return { cost, from };
    done[at] = true;
    const tx = at % SCREEN_W;
    const ty = Math.floor(at / SCREEN_W);
    for (const [dx, dy] of STEPS) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!isWalkable(place, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && !(isWalkable(place, nx, ty) && isWalkable(place, tx, ny)))
        continue;
      const next = tileIndex(nx, ny);
      const c = cost[at]! + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (c < cost[next]!) {
        cost[next] = c;
        from[next] = at;
      }
    }
  }
}

/** Past the screen on an axis where `v` is off it and the goal tile is on that edge, else `centre`. */
function past(v: number, size: number, t: number, tiles: number, centre: number): number {
  if (v < 0 && t === 0) return -TILE;
  if (v >= size && t === tiles - 1) return size + TILE;
  return centre;
}

/** Where to walk off the screen from goal tile (tx, ty) toward a `to` past its edge. */
function exitPast(to: Point, tx: number, ty: number): Point | undefined {
  const centre = tileCentre(tx, ty);
  const x = past(to.x, SCREEN_PX_W, tx, SCREEN_W, centre.x);
  const y = past(to.y - BOX_DROP, SCREEN_PX_H, ty, SCREEN_H, centre.y);
  return x === centre.x && y === centre.y ? undefined : { x, y };
}

/**
 * The waypoints of a walk from the feet at `from` toward the feet at `to`, in straight lines
 * with a turn at each waypoint. `from` itself is left out.
 *
 * When `to` is blocked or cut off, the walk ends at the centre of the reachable tile nearest it.
 * A `to` past a screen edge walks off that edge from the nearest reachable tile on it.
 */
export function findRoute(place: Place, from: Point, to: Point): Point[] {
  const start = tileUnder(from);
  const { cost, from: previous } = flood(place, start);
  let goal = -1;
  let best = Infinity;
  for (let i = 0; i < cost.length; i++) {
    if (cost[i] === Infinity) continue;
    const c = tileCentre(i % SCREEN_W, Math.floor(i / SCREEN_W));
    const d = Math.hypot(c.x - to.x, c.y - to.y);
    if (d < best || (d === best && cost[i]! < cost[goal]!)) {
      best = d;
      goal = i;
    }
  }

  const path: Point[] = [];
  for (let at = goal; at >= 0; at = previous[at]!)
    path.unshift(tileCentre(at % SCREEN_W, Math.floor(at / SCREEN_W)));
  const gx = goal % SCREEN_W;
  const gy = Math.floor(goal / SCREEN_W);
  const exit = exitPast(to, gx, gy);
  const target = tileUnder(to);
  const onGoal = !exit && target.tx === gx && target.ty === gy;
  if (onGoal && clearLine(place, path.at(-1)!, to)) path.push(to);
  const route = smooth(place, [from, ...path]).slice(1);
  return exit ? [...route, exit] : route;
}

/** Keeps a waypoint only where the straight line past it would not be clear. */
function smooth(place: Place, points: readonly Point[]): Point[] {
  const kept = [points[0]!];
  let at = 0;
  while (at < points.length - 1) {
    let next = points.length - 1;
    while (next > at + 1 && !clearLine(place, points[at]!, points[next]!)) next--;
    kept.push(points[next]!);
    at = next;
  }
  return kept;
}
