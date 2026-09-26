import type { Place, Tile } from './place.ts';
import {
  BLOCKING_FEATURES,
  DIR_DELTA,
  SCREEN_H,
  SCREEN_W,
  TILE,
  featureAt,
  inScreen,
  tileCorners,
  tileIndex,
  type Pose,
  type Screen,
} from './world.ts';

/** The generated rule, without traces. The generator and its tests use it. */
export function isTileWalkable(screen: Screen, tx: number, ty: number): boolean {
  if (BLOCKING_FEATURES.has(featureAt(screen, tx, ty))) return false;
  return tileCorners(screen, tx, ty).filter((t) => t === 'water').length < 3;
}

/** The play-time rule, with every trace on the place applied. */
export function isWalkable(place: Place, tx: number, ty: number): boolean {
  return inScreen(tx, ty) && place.tiles[tileIndex(tx, ty)]!.walkable;
}

/**
 * A player's position is the point between their feet, in screen pixels. Collision uses a
 * small box around the feet so the head and body can overlap the tile above, as in Zelda.
 */
export const FEET = { halfW: 5, up: 4, down: 1 } as const;

/** The tiles the feet box at (x, y) touches, clipped to the screen. */
export function boxTiles(x: number, y: number): Tile[] {
  const left = Math.floor((x - FEET.halfW) / TILE);
  const right = Math.floor((x + FEET.halfW - 1e-6) / TILE);
  const top = Math.floor((y - FEET.up) / TILE);
  const bottom = Math.floor((y + FEET.down - 1e-6) / TILE);
  const tiles: Tile[] = [];
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) if (inScreen(tx, ty)) tiles.push({ tx, ty });
  }
  return tiles;
}

/**
 * Whether the feet box fits at (x, y). Pixels past the screen edge count as open, so a player
 * can step off an edge; the server decides what is on the other side.
 */
export function canOccupy(place: Place, x: number, y: number): boolean {
  return boxTiles(x, y).every(({ tx, ty }) => isWalkable(place, tx, ty));
}

export function boxCentre({ x, y }: Pick<Pose, 'x' | 'y'>): { x: number; y: number } {
  return { x, y: y + (FEET.down - FEET.up) / 2 };
}

export function centreTile(pose: Pose): Tile {
  const { x, y } = boxCentre(pose);
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

/** The tile a player acts on: one step from the tile holding the centre of their feet. */
export function facedTile(pose: Pose): Tile | undefined {
  const { tx, ty } = centreTile(pose);
  const { dx, dy } = DIR_DELTA[pose.dir];
  return inScreen(tx + dx, ty + dy) ? { tx: tx + dx, ty: ty + dy } : undefined;
}

export const REACH = 1;

export function inReach(pose: Pose, { tx, ty }: Tile): boolean {
  const centre = centreTile(pose);
  return Math.max(Math.abs(tx - centre.tx), Math.abs(ty - centre.ty)) <= REACH;
}

export function overlapsBox(tile: Tile, pose: Pose): boolean {
  return boxTiles(pose.x, pose.y).some(({ tx, ty }) => tx === tile.tx && ty === tile.ty);
}

export type Way = 'open' | 'edge' | 'splits';

const STEPS = Object.values(DIR_DELTA);

/**
 * Whether making `tile` solid keeps the world connected: 'edge' on the screen border, 'splits'
 * when its walkable 4-neighbours lose their connection to each other, else 'open'. Any path
 * through the tile can go around it through those neighbours, so nobody is ever stranded.
 */
export function wayIfSolid(place: Place, { tx, ty }: Tile): Way {
  if (tx === 0 || ty === 0 || tx === SCREEN_W - 1 || ty === SCREEN_H - 1) return 'edge';
  const around = STEPS.map(({ dx, dy }) => ({ tx: tx + dx, ty: ty + dy })).filter((n) =>
    isWalkable(place, n.tx, n.ty),
  );
  if (around.length <= 1) return 'open';
  const seen = new Set<number>([tileIndex(tx, ty), tileIndex(around[0]!.tx, around[0]!.ty)]);
  const stack = [around[0]!];
  while (stack.length > 0) {
    const at = stack.pop()!;
    for (const { dx, dy } of STEPS) {
      const nx = at.tx + dx;
      const ny = at.ty + dy;
      if (!isWalkable(place, nx, ny) || seen.has(tileIndex(nx, ny))) continue;
      seen.add(tileIndex(nx, ny));
      stack.push({ tx: nx, ty: ny });
    }
  }
  return around.every((n) => seen.has(tileIndex(n.tx, n.ty))) ? 'open' : 'splits';
}
