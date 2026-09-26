import {
  GARDEN_SPAWN,
  SCREEN_H,
  SCREEN_W,
  TILE,
  boxTiles,
  canOccupy,
  type Place,
  type Pose,
} from '@explore/core';

/** Where the feet sit within a tile: the same footing as the garden spawn. */
const FOOT_Y = GARDEN_SPAWN.y % TILE;

const standingOn = (tx: number, ty: number): Pose => ({
  x: (tx + 0.5) * TILE,
  y: ty * TILE + FOOT_Y,
  dir: 's',
  moving: false,
});

const key = ({ tx, ty }: { tx: number; ty: number }) => `${tx},${ty}`;

/**
 * A visitor's first pose on a screen: standing on a walkable tile chosen at random from those
 * whose feet box touches no tile anyone present has their feet on. TASK-67's portal opens on
 * this tile. `random` is uniform on [0, 1). Falls back to the garden spawn when the screen has
 * no room, which the garden never lacks.
 */
export function visitorPose(
  place: Place,
  present: Iterable<Pose>,
  random: () => number = Math.random,
): Pose {
  const taken = new Set<string>();
  for (const pose of present) for (const tile of boxTiles(pose.x, pose.y)) taken.add(key(tile));
  const free: Pose[] = [];
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const pose = standingOn(tx, ty);
      if (!canOccupy(place, pose.x, pose.y)) continue;
      if (boxTiles(pose.x, pose.y).some((tile) => taken.has(key(tile)))) continue;
      free.push(pose);
    }
  }
  if (free.length === 0) return { ...GARDEN_SPAWN, moving: false };
  return free[Math.min(free.length - 1, Math.floor(random() * free.length))]!;
}
