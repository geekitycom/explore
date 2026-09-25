import { GARDEN_COORD, secretGarden } from '../src/garden.ts';
import { generateScreen, neighborsOf } from '../src/generate.ts';
import type { Feature, Screen, Terrain } from '../src/world.ts';

/** A point of interest, positioned by tile within its screen. */
export type PreviewPoi = { readonly kind: string; readonly tx: number; readonly ty: number };

/**
 * What the preview draws for one screen. Terrain is on the corner lattice and features on tiles,
 * as in `Screen`. Overlays are per tile and optional, so a source only fills what it knows.
 */
export type SourceScreen = {
  readonly corners: readonly Terrain[];
  readonly features: readonly Feature[];
  readonly biomes?: readonly string[];
  readonly roads?: readonly boolean[];
  readonly pois?: readonly PreviewPoi[];
};

export interface WorldSource {
  readonly name: string;
  screen(sx: number, sy: number): SourceScreen;
}

/** Hashes (seed, sx, sy) into a 31-bit screen seed, so a screen's seed never depends on order. */
function screenSeed(seed: number, sx: number, sy: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul(sx, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h ^= Math.imul(sy, 0x27d4eb2f);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 1;
}

/** Ring `r` around the garden, clockwise from its north-west corner. */
function ring(r: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let x = -r; x < r; x++) cells.push([x, -r]);
  for (let y = -r; y < r; y++) cells.push([r, y]);
  for (let x = r; x > -r; x--) cells.push([x, r]);
  for (let y = r; y > -r; y--) cells.push([-r, y]);
  return cells;
}

/**
 * The current neighbour-constrained generator. Neighbours shape each screen, so screens are grown
 * in whole rings outward from the garden: a screen then looks the same whatever area is asked for.
 */
export function neighbourSource(seed: number): WorldSource {
  const key = (sx: number, sy: number) => `${sx},${sy}`;
  const world = new Map<string, Screen>([[key(0, 0), secretGarden()]]);
  const lookup = ({ sx, sy }: { sx: number; sy: number }) => world.get(key(sx, sy));
  let grown = 0;

  return {
    name: 'neighbour-constrained',
    screen(sx, sy) {
      while (grown < Math.max(Math.abs(sx), Math.abs(sy))) {
        grown++;
        for (const [x, y] of ring(grown)) {
          const coord = { ...GARDEN_COORD, sx: x, sy: y };
          world.set(
            key(x, y),
            generateScreen(coord, screenSeed(seed, x, y), neighborsOf(coord, lookup)),
          );
        }
      }
      const screen = world.get(key(sx, sy))!;
      return sx === 0 && sy === 0 ? { ...screen, pois: [{ kind: 'hub', tx: 10, ty: 7 }] } : screen;
    },
  };
}
