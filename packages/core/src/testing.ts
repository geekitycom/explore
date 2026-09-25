import { generateScreen } from './generate.ts';
import {
  LATTICE_H,
  OVERWORLD,
  LATTICE_W,
  SCREEN_H,
  SCREEN_W,
  screenKey,
  type Feature,
  type Screen,
  type Terrain,
  type World,
  type WorldSeed,
} from './world.ts';

export function uniformScreen(terrain: Terrain = 'grass', feature: Feature = 'none'): Screen {
  return {
    coord: { layer: OVERWORLD, sx: 0, sy: 0 },
    biome: 'meadow',
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

export const worldOf = (seed: number): World => ({ seed: seed as WorldSeed });

export type Region = {
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
};

export function generateRegion(world: World, { x0, y0, w, h }: Region): Map<string, Screen> {
  const screens = new Map<string, Screen>();
  for (let sy = y0; sy < y0 + h; sy++) {
    for (let sx = x0; sx < x0 + w; sx++) {
      const coord = { layer: OVERWORLD, sx, sy };
      screens.set(screenKey(coord), generateScreen(world, coord));
    }
  }
  return screens;
}
