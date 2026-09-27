import {
  DIR_DELTA,
  GARDEN_SPAWN,
  SCREEN_H,
  SCREEN_W,
  TILE,
  boxTiles,
  canOccupy,
  inScreen,
  isWalkable,
  type Dir,
  type Place,
  type Pose,
  type Tile,
} from '@explore/core';

/** Where the feet sit within a tile: the same footing as the garden spawn. */
const FOOT_Y = GARDEN_SPAWN.y % TILE;

const standingOn = ({ tx, ty }: Tile): Pose => ({
  x: (tx + 0.5) * TILE,
  y: ty * TILE + FOOT_Y,
  dir: 's',
  moving: false,
});

const key = ({ tx, ty }: Tile) => `${tx},${ty}`;

/** The tiles under the feet of everyone at `poses`, which neither a portal nor a visitor may use. */
export function occupied(poses: Iterable<Pose>): Set<string> {
  const taken = new Set<string>();
  for (const pose of poses) for (const tile of boxTiles(pose.x, pose.y)) taken.add(key(tile));
  return taken;
}

/** `tile` is on the screen, someone could stand on it, and nobody's feet are on it. */
const free = (place: Place, taken: ReadonlySet<string>, tile: Tile) => {
  const { x, y } = standingOn(tile);
  return (
    isWalkable(place, tile.tx, tile.ty) &&
    canOccupy(place, x, y) &&
    !boxTiles(x, y).some((t) => taken.has(key(t)))
  );
};

export type VisitorArrival = { pose: Pose; portal: Tile };

/**
 * Where a visitor steps into a world: a portal opens on a tile and the visitor stands on the tile
 * just south of it, in front of the portal. The pair is chosen at random from those where both
 * tiles are free (see `occupied`). `random` is uniform on [0, 1). Falls back to the garden spawn,
 * with the portal behind it, when the screen has no room, which the garden never lacks.
 */
export function visitorArrival(
  place: Place,
  taken: ReadonlySet<string>,
  random: () => number = Math.random,
): VisitorArrival {
  const pairs: VisitorArrival[] = [];
  for (let ty = 1; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const portal = { tx, ty: ty - 1 };
      const tile = { tx, ty };
      if (free(place, taken, tile) && free(place, taken, portal))
        pairs.push({ pose: standingOn(tile), portal });
    }
  }
  if (pairs.length === 0) {
    const pose: Pose = { ...GARDEN_SPAWN, moving: false };
    return { pose, portal: { tx: Math.floor(pose.x / TILE), ty: Math.floor(pose.y / TILE) - 1 } };
  }
  return pairs[Math.min(pairs.length - 1, Math.floor(random() * pairs.length))]!;
}

/** North first, so a leaving player walks away into it; then the sides; south last. */
const DEPARTURE_ORDER: readonly Dir[] = ['n', 'e', 'w', 's'];

/**
 * The tile beside a leaving player where their portal opens: the first free neighbour of the tile
 * under their feet (see `occupied`), or that tile itself when every neighbour is blocked.
 */
export function departurePortal(place: Place, pose: Pose, taken: ReadonlySet<string>): Tile {
  const here = { tx: Math.floor(pose.x / TILE), ty: Math.floor(pose.y / TILE) };
  for (const dir of DEPARTURE_ORDER) {
    const { dx, dy } = DIR_DELTA[dir];
    const tile = { tx: here.tx + dx, ty: here.ty + dy };
    if (free(place, taken, tile)) return tile;
  }
  return here;
}

/**
 * The pose itself when the feet fit there, else the same player standing on the nearest tile
 * they fit on.
 */
export function unstuck(place: Place, pose: Pose): Pose {
  if (canOccupy(place, pose.x, pose.y)) return pose;
  const start = { tx: Math.floor(pose.x / TILE), ty: Math.floor(pose.y / TILE) };
  const seen = new Set([key(start)]);
  const queue: Tile[] = [start];
  for (let tile = queue.shift(); tile; tile = queue.shift()) {
    const { x, y } = standingOn(tile);
    if (isWalkable(place, tile.tx, tile.ty) && canOccupy(place, x, y))
      return { ...pose, x, y, moving: false };
    for (const { dx, dy } of Object.values(DIR_DELTA)) {
      const next = { tx: tile.tx + dx, ty: tile.ty + dy };
      if (!inScreen(next.tx, next.ty) || seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
  return pose;
}
