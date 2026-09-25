import type { Pose } from './protocol.ts';
import { FEET, canOccupy, isTileWalkable } from './walk.ts';
import {
  DIR_DELTA,
  SCREEN_H,
  SCREEN_PX_H,
  SCREEN_PX_W,
  SCREEN_W,
  TILE,
  inScreen,
  screenKey,
  tileIndex,
  type Dir,
  type Screen,
} from './world.ts';

type Point = { x: number; y: number };

type Edge = {
  /** The coordinate that carries over from the previous screen. */
  along: (p: Point) => number;
  /** Feet position `depth` pixels in from the edge the player enters through. */
  place: (along: number, depth: number) => Point;
  alongMin: number;
  alongMax: number;
  depthMax: number;
};

const WEST_OR_EAST = {
  along: (p: Point) => p.y,
  alongMin: FEET.up,
  alongMax: SCREEN_PX_H - FEET.down,
  depthMax: SCREEN_PX_W - TILE,
};
const NORTH_OR_SOUTH = {
  along: (p: Point) => p.x,
  alongMin: FEET.halfW,
  alongMax: SCREEN_PX_W - FEET.halfW,
  depthMax: SCREEN_PX_H - TILE,
};

/**
 * How far inside the entry edge a player's feet land, so the whole 16px sprite is on screen.
 * Entering from the bottom needs no inset because the sprite extends upward from the feet.
 */
const INSET_SIDE = TILE / 2;
const INSET_TOP = TILE - 2;

/** Keyed by the direction walked, so each entry describes the opposite edge of the target. */
const ENTRY: Record<Dir, Edge> = {
  e: { ...WEST_OR_EAST, place: (y, d) => ({ x: INSET_SIDE + d, y }) },
  w: { ...WEST_OR_EAST, place: (y, d) => ({ x: SCREEN_PX_W - INSET_SIDE - d, y }) },
  s: { ...NORTH_OR_SOUTH, place: (x, d) => ({ x, y: INSET_TOP + d }) },
  n: { ...NORTH_OR_SOUTH, place: (x, d) => ({ x, y: SCREEN_PX_H - FEET.down - d }) },
};

/**
 * The tiles of `to`'s entry edge a player walking `dir` off `from` can step onto: walkable on
 * both sides of the seam. Read from the two screens as stored, so it holds however each was made.
 */
export function seamOpenings(from: Screen, to: Screen, dir: Dir): [number, number][] {
  const { dx, dy } = DIR_DELTA[dir];
  const entry: [number, number][] =
    dx === 0
      ? Array.from({ length: SCREEN_W }, (_, tx) => [tx, dy > 0 ? 0 : SCREEN_H - 1])
      : Array.from({ length: SCREEN_H }, (_, ty) => [dx > 0 ? 0 : SCREEN_W - 1, ty]);
  return entry.filter(
    ([tx, ty]) =>
      isTileWalkable(to, tx, ty) &&
      isTileWalkable(from, tx + dx * (SCREEN_W - 1), ty + dy * (SCREEN_H - 1)),
  );
}

/** Arrivals are kept to these so a nudge along an edge never strands a player in a pocket. */
function reachableFrom(screen: Screen, entries: readonly [number, number][]): boolean[] {
  const seen = Array<boolean>(SCREEN_W * SCREEN_H).fill(false);
  const stack = entries.filter(([tx, ty]) => isTileWalkable(screen, tx, ty));
  for (const [tx, ty] of stack) seen[tileIndex(tx, ty)] = true;
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (!inScreen(nx, ny) || seen[tileIndex(nx, ny)] || !isTileWalkable(screen, nx, ny)) continue;
      seen[tileIndex(nx, ny)] = true;
      stack.push([nx, ny]);
    }
  }
  return seen;
}

/**
 * Where a player walking `dir` off a screen at `from` appears on `target`: just inside the
 * opposite edge at the mirrored coordinate, or the nearest spot along that edge that fits and
 * leads on from one of `entries`, stepping a tile inward at a time if the whole edge is blocked.
 */
export function arrivalPose(
  target: Screen,
  dir: Dir,
  from: Point,
  entries: readonly [number, number][],
): Pose {
  const edge = ENTRY[dir];
  const start = Math.min(Math.max(edge.along(from), edge.alongMin), edge.alongMax);
  const span = edge.alongMax - edge.alongMin;
  const allowed = reachableFrom(target, entries);
  for (let depth = 0; depth <= edge.depthMax; depth += TILE) {
    for (let offset = 0; offset <= span; offset++) {
      for (const along of offset === 0 ? [start] : [start - offset, start + offset]) {
        if (along < edge.alongMin || along > edge.alongMax) continue;
        const p = edge.place(along, depth);
        const tile = tileIndex(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
        if (allowed[tile] && canOccupy(target, p.x, p.y)) return { ...p, dir, moving: false };
      }
    }
  }
  throw new Error(`screen ${screenKey(target.coord)} has no walkable position`);
}
