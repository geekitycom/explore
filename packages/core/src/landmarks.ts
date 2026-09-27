import { networkOf } from './generate.ts';
import type { Place, Tile } from './place.ts';
import { type Poi, type PoiKind } from './poi.ts';
import { isWalkable, wayIfSolid } from './walk.ts';
import {
  SCREEN_H,
  SCREEN_W,
  featureAt,
  tileCorners,
  type ScreenCoord,
  type World,
} from './world.ts';

/** A landmark's footprint as an ellipse, in lattice units from the screen's top-left corner. */
export type Area = {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
};

export type Landmark = { readonly poi: Exclude<PoiKind, 'hub'>; readonly area: Area };

/** What players call each kind of landmark. */
export const LANDMARK_NOUNS: Readonly<Record<Landmark['poi'], string>> = {
  clearing: 'clearing',
  grove: 'grove',
  ruin: 'ruin',
  graveyard: 'graveyard',
  burialground: 'burial ground',
  lakeside: 'lakeside',
  stones: 'stone circle',
  town: 'village green',
  cave: 'cave',
};

const isLandmark = (poi: Poi): poi is Poi & { kind: Landmark['poi'] } => poi.kind !== 'hub';

/**
 * The landmark whose centre lies on this screen, if any. A footprint reaching onto a neighbour
 * belongs to the screen holding its centre, so each landmark is named in one place.
 */
export function landmarkOn(world: World, { layer, sx, sy }: ScreenCoord): Landmark | undefined {
  const x0 = sx * SCREEN_W;
  const y0 = sy * SCREEN_H;
  const poi = networkOf(world, layer)
    .poisIn({ x0, y0, x1: x0 + SCREEN_W, y1: y0 + SCREEN_H })
    .filter(isLandmark)
    .find((p) => Math.floor(p.x / SCREEN_W) === sx && Math.floor(p.y / SCREEN_H) === sy);
  if (!poi) return undefined;
  const [rx, ry] = poi.reach;
  return { poi: poi.kind, area: { x: poi.x - x0, y: poi.y - y0, rx, ry } };
}

/** The kind of landmark whose footprint holds this tile, such as the graveyard around a grave. */
export function landmarkAround(
  world: World,
  { layer, sx, sy }: ScreenCoord,
  tile: Tile,
): Landmark['poi'] | undefined {
  const x0 = sx * SCREEN_W;
  const y0 = sy * SCREEN_H;
  const [x, y] = [x0 + tile.tx, y0 + tile.ty];
  return networkOf(world, layer)
    .poisIn({ x0: x, y0: y, x1: x + 1, y1: y + 1 })
    .filter(isLandmark)
    .map((poi) => ({ poi, off: offCentre(areaOf(poi, x0, y0), tile) }))
    .filter(({ off }) => off <= 1)
    .sort((a, b) => a.off - b.off)
    .at(0)?.poi.kind;
}

const areaOf = ({ x, y, reach: [rx, ry] }: Poi, x0: number, y0: number): Area => ({
  x: x - x0,
  y: y - y0,
  rx,
  ry,
});

/** How far a tile's centre lies from the area's, where 1 is the area's rim. */
const offCentre = ({ x, y, rx, ry }: Area, { tx, ty }: Tile) =>
  ((tx + 0.5 - x) / rx) ** 2 + ((ty + 0.5 - y) / ry) ** 2;

export const inArea = (area: Area, tile: Tile): boolean => offCentre(area, tile) <= 1;

const NEIGHBOURS = [-1, 0, 1]
  .flatMap((dy) => [-1, 0, 1].map((dx) => ({ dx, dy })))
  .filter(({ dx, dy }) => dx !== 0 || dy !== 0);
const SIDES = NEIGHBOURS.filter(({ dx, dy }) => dx === 0 || dy === 0);

/** What a spot costs, on the scale of `offCentre`, for each blocked neighbour and for a plant. */
const CROWDED = 0.15;
const ON_A_PLANT = 0.5;

/**
 * Where the landmark's signpost stands on the place as it is, traces and all: a walkable tile in
 * the area, off any road and the screen's edge, whose post would keep the ground around it
 * connected, with a free tile in the area beside it to stand on. Of those, the one nearest the
 * centre on open, bare ground. So a post never blocks a road or cuts a way through, even in an
 * old world where players have left rocks about. `bare(screen)` gives the generated answer.
 */
export function signpostSpot(place: Place, area: Area): Tile | undefined {
  const { screen } = place;
  const open = ({ tx, ty }: Tile) => isWalkable(place, tx, ty);
  const beside = ({ tx, ty }: Tile, deltas: typeof NEIGHBOURS) =>
    deltas.map(({ dx, dy }) => ({ tx: tx + dx, ty: ty + dy }));
  const fits = (tile: Tile) =>
    inArea(area, tile) &&
    open(tile) &&
    !tileCorners(screen, tile.tx, tile.ty).includes('path') &&
    wayIfSolid(place, tile) === 'open' &&
    beside(tile, SIDES).some((n) => open(n) && inArea(area, n));
  const cost = (tile: Tile) =>
    offCentre(area, tile) +
    CROWDED * beside(tile, NEIGHBOURS).filter((n) => !open(n)).length +
    (featureAt(screen, tile.tx, tile.ty) === 'none' ? 0 : ON_A_PLANT);
  const tiles: Tile[] = [];
  for (let ty = 1; ty < SCREEN_H - 1; ty++) {
    for (let tx = 1; tx < SCREEN_W - 1; tx++) tiles.push({ tx, ty });
  }
  return tiles
    .filter(fits)
    .map((tile) => ({ tile, cost: cost(tile) }))
    .sort((a, b) => a.cost - b.cost || a.tile.ty - b.tile.ty || a.tile.tx - b.tile.tx)
    .at(0)?.tile;
}
