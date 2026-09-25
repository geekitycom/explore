import { GARDEN_COORD, secretGarden } from './garden.ts';
import { generateScreen, neighborsOf } from './generate.ts';
import { createRng } from './rng.ts';
import {
  DIRS,
  LATTICE_H,
  OVERWORLD,
  LATTICE_W,
  SCREEN_H,
  SCREEN_W,
  neighborCoord,
  screenKey,
  type Feature,
  type Screen,
  type ScreenCoord,
  type Terrain,
} from './world.ts';

export function uniformScreen(terrain: Terrain = 'grass', feature: Feature = 'none'): Screen {
  return {
    coord: { layer: OVERWORLD, sx: 0, sy: 0 },
    seed: 0,
    corners: Array<Terrain>(LATTICE_W * LATTICE_H).fill(terrain),
    features: Array<Feature>(SCREEN_W * SCREEN_H).fill(feature),
  };
}

export function withCorners(screen: Screen, points: [number, number, Terrain][]): Screen {
  const corners = [...screen.corners];
  for (const [cx, cy, t] of points) corners[cy * LATTICE_W + cx] = t;
  return { ...screen, corners };
}

export function withFeatures(screen: Screen, tiles: [number, number, Feature][]): Screen {
  const features = [...screen.features];
  for (const [tx, ty, f] of tiles) features[ty * SCREEN_W + tx] = f;
  return { ...screen, features };
}

/** Grows a world outward from the garden the way players would: one adjacent discovery at a time. */
export function growWorld(
  seed: number,
  discoveries: number,
): { world: Map<string, Screen>; order: string[] } {
  const rng = createRng(seed);
  const world = new Map<string, Screen>([[screenKey(GARDEN_COORD), secretGarden()]]);
  const order = [screenKey(GARDEN_COORD)];
  const lookup = (c: ScreenCoord) => world.get(screenKey(c));
  while (order.length <= discoveries) {
    const from = world.get(order[Math.floor(rng() * order.length)]!)!;
    const dir = DIRS[Math.floor(rng() * DIRS.length)]!;
    const coord = neighborCoord(from.coord, dir);
    if (lookup(coord)) continue;
    const screen = generateScreen(coord, Math.floor(rng() * 2 ** 31), neighborsOf(coord, lookup));
    world.set(screenKey(coord), screen);
    order.push(screenKey(coord));
  }
  return { world, order };
}
