import {
  OVERWORLD,
  screenBiome,
  secretGarden,
  type ScreenCoord,
  type WorldSeed,
} from '@explore/core';
import { expect, test } from 'vitest';
import { tuneFor } from './mood.ts';

const world = { seed: 1234 as WorldSeed };
const coords: ScreenCoord[] = [];
for (let sy = -12; sy <= 12; sy++) {
  for (let sx = -12; sx <= 12; sx++) coords.push({ layer: OVERWORLD, sx, sy });
}
const tuneAt = (coord: ScreenCoord) => {
  const { biome, cell } = screenBiome(world, coord);
  return tuneFor(biome, cell);
};

test('every screen of a patch plays one tune, and each patch has its own', () => {
  const tunesByPatch = new Map<string, Set<string>>();
  for (const coord of coords) {
    const { cell } = screenBiome(world, coord);
    const patch = `${cell.x},${cell.y}`;
    tunesByPatch.set(patch, (tunesByPatch.get(patch) ?? new Set()).add(tuneAt(coord).key));
  }
  expect(tunesByPatch.size).toBeGreaterThan(4);
  for (const tunes of tunesByPatch.values()) expect(tunes.size).toBe(1);
  const keys = [...tunesByPatch.values()].map((tunes) => [...tunes][0]);
  expect(new Set(keys).size).toBe(keys.length);
});

test('the tune plays the biome of its patch', () => {
  for (const coord of coords) expect(tuneAt(coord).biome).toBe(screenBiome(world, coord).biome);
});

test('the garden has its own tune apart from the meadow patch around it', () => {
  const { cell } = screenBiome(world, secretGarden().coord);
  expect(tuneFor('garden', cell).key).toBe('garden:1');
  expect(tuneFor('meadow', cell).key).not.toBe('garden:1');
});
