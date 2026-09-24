import {
  LATTICE_H,
  LATTICE_W,
  SCREEN_H,
  SCREEN_W,
  type Feature,
  type Screen,
  type Terrain,
} from './world.ts';

export function uniformScreen(terrain: Terrain = 'grass', feature: Feature = 'none'): Screen {
  return {
    coord: { sx: 0, sy: 0 },
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
