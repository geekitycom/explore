import { GARDEN_COORD } from '../src/garden.ts';
import { biomeAt, generateScreen, networkOf } from '../src/generate.ts';
import { SCREEN_H, SCREEN_W, type Feature, type Terrain, type WorldSeed } from '../src/world.ts';

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
  /** Tiles inside a footprint a point of interest reserves. */
  readonly reserved?: readonly boolean[];
  readonly pois?: readonly PreviewPoi[];
};

export interface WorldSource {
  readonly name: string;
  screen(sx: number, sy: number): SourceScreen;
}

export function fieldsSource(seed: number): WorldSource {
  const world = { seed: seed as WorldSeed };
  return {
    name: 'world-seeded fields',
    screen(sx, sy) {
      const screen = generateScreen(world, { ...GARDEN_COORD, sx, sy });
      const biomes = Array.from({ length: SCREEN_W * SCREEN_H }, (_, i) => {
        if (screen.biome === 'garden') return 'garden';
        const gx = sx * SCREEN_W + (i % SCREEN_W) + 0.5;
        const gy = sy * SCREEN_H + Math.floor(i / SCREEN_W) + 0.5;
        return biomeAt(world, GARDEN_COORD.layer, gx, gy).biome;
      });
      const x0 = sx * SCREEN_W;
      const y0 = sy * SCREEN_H;
      const box = { x0, y0, x1: x0 + SCREEN_W, y1: y0 + SCREEN_H };
      const network = networkOf(world, GARDEN_COORD.layer);
      const plan = network.plan(box);
      const everyCorner = (i: number, test: (gx: number, gy: number) => boolean) => {
        const gx = x0 + (i % SCREEN_W);
        const gy = y0 + Math.floor(i / SCREEN_W);
        return test(gx, gy) && test(gx + 1, gy) && test(gx, gy + 1) && test(gx + 1, gy + 1);
      };
      const tiles = Array.from({ length: SCREEN_W * SCREEN_H }, (_, i) => i);
      const roads = tiles.map((i) => everyCorner(i, plan.road));
      // A stamp is kept verbatim, so the network flattens nothing on it.
      const stamped = screen.biome === 'garden';
      const reserved = tiles.map(
        (i) => !stamped && everyCorner(i, (gx, gy) => !!plan.ground(gx, gy)),
      );
      const pois = network
        .poisIn(box)
        .filter((p) => p.x >= x0 && p.x < x0 + SCREEN_W && p.y >= y0 && p.y < y0 + SCREEN_H)
        .map((p) => ({ kind: p.kind, tx: Math.floor(p.x - x0), ty: Math.floor(p.y - y0) }));
      return { ...screen, biomes, roads, reserved, pois };
    },
  };
}
