import {
  SCREEN_PX_H,
  SCREEN_PX_W,
  TILE,
  WALK_SPEED,
  boxCentre,
  canOccupy,
  clampFeetOntoScreen,
  type Dir,
  type Place,
  type Pose,
} from '@explore/core';

type Held = ReadonlySet<Dir>;

type Step = { pose: Pose; exit: Dir | undefined };

function exitDir(x: number, y: number): Dir | undefined {
  if (x < 0) return 'w';
  if (x >= SCREEN_PX_W) return 'e';
  if (y < 0) return 'n';
  if (y >= SCREEN_PX_H) return 's';
  return undefined;
}

/** Facing prefers the most recently pressed key, so diagonal walks look natural. */
function facing(held: Held, current: Dir, lastPressed: Dir | undefined): Dir {
  if (lastPressed && held.has(lastPressed)) return lastPressed;
  return held.has(current) ? current : ([...held][0] ?? current);
}

export function step(
  place: Place,
  pose: Pose,
  held: Held,
  dtSeconds: number,
  lastPressed?: Dir,
): Step {
  const dx = (held.has('e') ? 1 : 0) - (held.has('w') ? 1 : 0);
  const dy = (held.has('s') ? 1 : 0) - (held.has('n') ? 1 : 0);
  if (dx === 0 && dy === 0) return { pose: { ...pose, moving: false }, exit: undefined };

  const scale = (WALK_SPEED * dtSeconds) / (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
  let { x, y } = pose;
  const to = clampFeetOntoScreen(x + dx * scale, y + dy * scale);
  if (dx !== 0 && canOccupy(place, to.x, y)) x = to.x;
  if (dy !== 0 && canOccupy(place, x, to.y)) y = to.y;

  const moved = x !== pose.x || y !== pose.y;
  return {
    pose: { x, y, dir: facing(held, pose.dir, lastPressed), moving: moved },
    exit: exitDir(x, y),
  };
}

/** Clockwise from east, in screen coordinates where y grows downward. */
const SECTORS: readonly Held[] = [
  new Set(['e']),
  new Set(['e', 's']),
  new Set(['s']),
  new Set(['s', 'w']),
  new Set(['w']),
  new Set(['w', 'n']),
  new Set(['n']),
  new Set(['n', 'e']),
];
const STILL: Held = new Set();
/** Close enough to the pointer to stop, so the avatar halts under the finger. */
const DEAD_ZONE = TILE / 2;

/**
 * A point in the outermost tile band moves this far past its edge, so the avatar keeps walking
 * until it leaves the screen instead of stopping just short of the edge.
 */
const PUSH = 2 * TILE;

function pushed(v: number, size: number): number {
  if (v < TILE) return v - PUSH;
  if (v >= size - TILE) return v + PUSH;
  return v;
}

export type Steer = { held: Held; facing: Dir | undefined };

/** The directions to hold to walk toward `target`, in 8 sectors, and the way to face. */
export function steer(pose: Pose, target: { x: number; y: number }): Steer {
  const from = boxCentre(pose);
  const dx = pushed(target.x, SCREEN_PX_W) - from.x;
  const dy = pushed(target.y, SCREEN_PX_H) - from.y;
  if (Math.hypot(dx, dy) < DEAD_ZONE) return { held: STILL, facing: undefined };
  const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  const facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
  return { held: SECTORS[sector]!, facing };
}
