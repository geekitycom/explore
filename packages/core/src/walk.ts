import { BLOCKING_FEATURES, TILE, featureAt, inScreen, tileCorners, type Screen } from './world.ts';

export function isTileWalkable(screen: Screen, tx: number, ty: number): boolean {
  if (BLOCKING_FEATURES.has(featureAt(screen, tx, ty))) return false;
  return tileCorners(screen, tx, ty).filter((t) => t === 'water').length < 3;
}

/**
 * A player's position is the point between their feet, in screen pixels. Collision uses a
 * small box around the feet so the head and body can overlap the tile above, as in Zelda.
 */
export const FEET = { halfW: 5, up: 4, down: 1 } as const;

/**
 * Whether the feet box fits at (x, y). Pixels past the screen edge count as open, so a player
 * can step off an edge; the server decides what is on the other side.
 */
export function canOccupy(screen: Screen, x: number, y: number): boolean {
  const left = Math.floor((x - FEET.halfW) / TILE);
  const right = Math.floor((x + FEET.halfW - 1e-6) / TILE);
  const top = Math.floor((y - FEET.up) / TILE);
  const bottom = Math.floor((y + FEET.down - 1e-6) / TILE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (inScreen(tx, ty) && !isTileWalkable(screen, tx, ty)) return false;
    }
  }
  return true;
}
