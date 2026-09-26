import { describe, expect, test } from 'vitest';
import { BIOME_PARAMS, type BiomeParams } from './biome.ts';
import { GARDEN_COORD } from './garden.ts';
import { biomeAt, generateScreen } from './generate.ts';
import { worldOf } from './testing.ts';
import { OVERWORLD, SCREEN_H, SCREEN_W } from './world.ts';

const SEEDS = [1, 2, 3, 4, 5, 6].map((i) => 1000 + i * 7919);

const paramsAt = (seed: number, x: number, y: number) =>
  biomeAt(worldOf(seed), OVERWORLD, x, y).params;

const KEYS = Object.keys(BIOME_PARAMS.meadow) as (keyof BiomeParams)[];
const ALL = Object.values(BIOME_PARAMS);
const RANGE = Object.fromEntries(
  KEYS.map((k) => [k, Math.max(...ALL.map((p) => p[k])) - Math.min(...ALL.map((p) => p[k]))]),
) as Record<keyof BiomeParams, number>;

/** Summed difference of every param, each scaled by its range across biomes. */
const distance = (a: BiomeParams, b: BiomeParams) =>
  KEYS.reduce((sum, k) => sum + Math.abs(a[k] - b[k]) / RANGE[k], 0);

const differs = (a: BiomeParams, b: BiomeParams) => distance(a, b) > 1e-9;

/** The biome at each screen's centre over a square of screens, and the sizes of its patches. */
function screenPatches(seed: number, radius: number) {
  const side = 2 * radius;
  const biomes = Array.from({ length: side * side }, (_, i) => {
    const sx = (i % side) - radius;
    const sy = Math.floor(i / side) - radius;
    return biomeAt(worldOf(seed), OVERWORLD, (sx + 0.5) * SCREEN_W, (sy + 0.5) * SCREEN_H).biome;
  });
  const seen = new Set<number>();
  const sizes: number[] = [];
  for (let start = 0; start < biomes.length; start++) {
    if (seen.has(start)) continue;
    seen.add(start);
    const stack = [start];
    let size = 0;
    while (stack.length > 0) {
      const i = stack.pop()!;
      size++;
      const x = i % side;
      const neighbours = [x > 0 && i - 1, x < side - 1 && i + 1, i - side, i + side];
      for (const j of neighbours) {
        if (j === false || j < 0 || j >= biomes.length || seen.has(j)) continue;
        if (biomes[j] !== biomes[i]) continue;
        seen.add(j);
        stack.push(j);
      }
    }
    sizes.push(size);
  }
  return { biomes, sizes };
}

describe('biomes', () => {
  test('form regions that span several screens, with a variety of biomes', () => {
    for (const seed of SEEDS) {
      const { biomes, sizes } = screenPatches(seed, 30);
      const inBigPatches = sizes.filter((n) => n >= 9).reduce((sum, n) => sum + n, 0);
      expect(inBigPatches / biomes.length).toBeGreaterThan(0.9);
      expect(new Set(biomes).size).toBeGreaterThanOrEqual(4);
    }
  });

  test.each(SEEDS)(
    'blend their params across a border in seed %i instead of stepping at a line',
    (seed) => {
      let borders = 0;
      for (let y = -600; y <= 600; y += 97) {
        let previous = biomeAt(worldOf(seed), OVERWORLD, -1200, y);
        for (let x = -1199; x <= 1200; x++) {
          const here = biomeAt(worldOf(seed), OVERWORLD, x, y);
          if (here.biome !== previous.biome) {
            borders++;
            const from = BIOME_PARAMS[previous.biome];
            const to = BIOME_PARAMS[here.biome];
            const where = `seed ${seed} at ${x},${y}`;
            expect(distance(here.params, previous.params), where).toBeLessThan(
              0.35 * distance(to, from),
            );
            expect(differs(paramsAt(seed, x + 5, y), to), where).toBe(true);
            expect(differs(paramsAt(seed, x - 6, y), from), where).toBe(true);
          }
          previous = here;
        }
      }
      expect(borders).toBeGreaterThan(8);
    },
  );

  test.each(SEEDS)(
    'never blend snow with sand in seed %i, so snow never borders desert',
    (seed) => {
      const problems: string[] = [];
      for (let y = -4000; y <= 4000; y += 37) {
        for (let x = -5000; x <= 5000; x += 37) {
          const { snow, sand } = paramsAt(seed, x, y);
          if (snow > 0.01 && sand > 0.01) problems.push(`seed ${seed} at ${x},${y}`);
        }
      }
      expect(problems).toEqual([]);
    },
  );

  test.each(SEEDS)('put the garden in a meadow in seed %i', (seed) => {
    for (const [dx, dy] of [
      [0, 0],
      [-1, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
    ] as const) {
      expect(generateScreen(worldOf(seed), { ...GARDEN_COORD, sx: dx, sy: dy }).biome).toBe(
        dx === 0 && dy === 0 ? 'garden' : 'meadow',
      );
    }
  });

  test('are recorded on each screen as the biome at its centre', () => {
    const world = worldOf(SEEDS[1]!);
    for (let sx = -30; sx <= 30; sx += 6) {
      const coord = { layer: OVERWORLD, sx, sy: 11 };
      const centre = biomeAt(world, OVERWORLD, (sx + 0.5) * SCREEN_W, 11.5 * SCREEN_H);
      expect(generateScreen(world, coord).biome).toBe(centre.biome);
    }
  });
});
