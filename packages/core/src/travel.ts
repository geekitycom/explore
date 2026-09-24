import type { Pose } from './protocol.ts';
import { FEET, canOccupy } from './walk.ts';
import { SCREEN_PX_H, SCREEN_PX_W, TILE, type Dir, type Screen } from './world.ts';

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
 * Where a player walking `dir` off a screen at `from` appears on `target`: just inside the
 * opposite edge at the mirrored coordinate, or the nearest spot along that edge that fits,
 * stepping a tile inward at a time if the whole edge is blocked.
 */
export function arrivalPose(target: Screen, dir: Dir, from: Point): Pose {
  const edge = ENTRY[dir];
  const start = Math.min(Math.max(edge.along(from), edge.alongMin), edge.alongMax);
  const span = edge.alongMax - edge.alongMin;
  for (let depth = 0; depth <= edge.depthMax; depth += TILE) {
    for (let offset = 0; offset <= span; offset++) {
      for (const along of offset === 0 ? [start] : [start - offset, start + offset]) {
        if (along < edge.alongMin || along > edge.alongMax) continue;
        const p = edge.place(along, depth);
        if (canOccupy(target, p.x, p.y)) return { ...p, dir, moving: false };
      }
    }
  }
  throw new Error(`screen ${target.coord.sx},${target.coord.sy} has no walkable position`);
}
