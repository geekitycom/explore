import type { Biome, BiomeCell } from '@explore/core';

export type Tune = { biome: Biome; seed: number; key: string };

/** Everyone in the same biome patch hears the same tune, and it changes only at the patch's edge. */
export function tuneFor(biome: Biome, patch: BiomeCell): Tune {
  const seed =
    biome === 'garden' ? 1 : (Math.imul(patch.x, 73856093) ^ Math.imul(patch.y, 19349663)) >>> 0;
  return { biome, seed, key: `${biome}:${seed}` };
}
