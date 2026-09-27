import {
  FEET,
  SCREEN_PX_H,
  SCREEN_PX_W,
  TILE,
  WALK_SPEED,
  canOccupy,
  canWalk,
  clampFeetOntoScreen,
  type Dir,
  type Place,
  type Point,
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

/**
 * A pointer in the outermost tile band aims this far past its edge, so the avatar keeps walking
 * until it leaves the screen instead of stopping just short of the edge.
 */
const PUSH = 2 * TILE;

function pushed(v: number, size: number): number {
  if (v < TILE) return v - PUSH;
  if (v >= size - TILE) return v + PUSH;
  return v;
}

/** The feet position a walk toward the pointer at `point` heads for. */
export function goalFor(point: Point): Point {
  return {
    x: pushed(point.x, SCREEN_PX_W),
    y: pushed(point.y, SCREEN_PX_H) + (FEET.up - FEET.down) / 2,
  };
}

const facingAlong = (dx: number, dy: number): Dir =>
  Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';

/**
 * One frame along a route from `findRoute`: straight toward the next waypoint at WALK_SPEED,
 * returning the waypoints still ahead. A frame stops at a waypoint rather than turning in it, so
 * each frame is one straight step. A step `canWalk` refuses slides along one axis instead.
 */
export function follow(
  place: Place,
  pose: Pose,
  route: readonly Point[],
  dtSeconds: number,
): Step & { route: readonly Point[] } {
  let ahead = route;
  while (ahead[0] && ahead[0].x === pose.x && ahead[0].y === pose.y) ahead = ahead.slice(1);
  const next = ahead[0];
  if (!next) return { pose: { ...pose, moving: false }, exit: undefined, route: ahead };

  const dx = next.x - pose.x;
  const dy = next.y - pose.y;
  const distance = Math.hypot(dx, dy);
  const reach = WALK_SPEED * dtSeconds;
  const arrives = distance <= reach;
  const to = arrives
    ? clampFeetOntoScreen(next.x, next.y)
    : clampFeetOntoScreen(pose.x + (dx / distance) * reach, pose.y + (dy / distance) * reach);
  const at = [to, { x: to.x, y: pose.y }, { x: pose.x, y: to.y }].find((p) =>
    canWalk(place, pose, p),
  );
  const { x, y } = at ?? pose;
  const moved = x !== pose.x || y !== pose.y;
  return {
    pose: { x, y, dir: facingAlong(dx, dy), moving: moved },
    exit: exitDir(x, y),
    route: at === to && arrives ? ahead.slice(1) : ahead,
  };
}
