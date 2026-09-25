import {
  SCREEN_PX_H,
  SCREEN_PX_W,
  WALK_SPEED,
  canOccupy,
  type Dir,
  type Pose,
  type Screen,
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
  screen: Screen,
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
  if (dx !== 0 && canOccupy(screen, x + dx * scale, y)) x += dx * scale;
  if (dy !== 0 && canOccupy(screen, x, y + dy * scale)) y += dy * scale;

  const moved = x !== pose.x || y !== pose.y;
  return {
    pose: { x, y, dir: facing(held, pose.dir, lastPressed), moving: moved },
    exit: exitDir(x, y),
  };
}
