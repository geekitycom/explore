import { GARDEN_COORD } from '../src/garden.ts';
import { biomeAt, generateScreen } from '../src/generate.ts';
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
      const pois = screen.biome === 'garden' ? [{ kind: 'hub', tx: 10, ty: 7 }] : [];
      return { ...screen, biomes, pois };
    },
  };
}
