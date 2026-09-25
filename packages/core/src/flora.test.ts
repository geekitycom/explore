import { describe, expect, test } from 'vitest';
import { FLORA, speciesAt, type PlacedFeature } from './flora.ts';
import { BIOME_RAMPS, PALETTE_BIOMES, RAMPS, type RampName } from './palette.ts';
import { FEATURES, type Biome } from './world.ts';

const PLACED = FEATURES.filter((f): f is PlacedFeature => f !== 'none');
const isRamp = (v: unknown): v is RampName => typeof v === 'string' && v in RAMPS;
const names = (biome: Biome) =>
  Object.values(FLORA[biome]).flatMap((list) => list.map((s) => s.name));

describe('flora catalogue', () => {
  test.each(PALETTE_BIOMES)('%s has at least three named species', (biome) => {
    expect(new Set(names(biome)).size).toBeGreaterThanOrEqual(3);
  });

  test.each(PALETTE_BIOMES)('%s species draw only from the biome flora ramps', (biome) => {
    const allowed = new Set<RampName>(BIOME_RAMPS[biome].flora);
    for (const list of Object.values(FLORA[biome])) {
      for (const { name, recipe } of list) {
        const ramps = Object.values(recipe.params).filter(isRamp);
        expect(
          ramps.filter((r) => !allowed.has(r)),
          `${biome} ${name}`,
        ).toEqual([]);
      }
    }
  });

  test('biomes grow the species doc-4 models them on', () => {
    expect(names('meadow')).toEqual(expect.arrayContaining(['English oak', 'Common poppy']));
    expect(names('taiga')).toEqual(expect.arrayContaining(['Norway spruce', 'Siberian larch']));
    expect(names('desert')).toEqual(expect.arrayContaining(['Saguaro', 'Agave', 'Joshua tree']));
    expect(names('highlands')).toEqual(expect.arrayContaining(['Scots pine', 'Heather']));
    expect(names('tundra')).toEqual(expect.arrayContaining(['Cotton grass', 'Dwarf willow']));
  });

  test('every biome lists at least one species for every feature', () => {
    for (const flora of Object.values(FLORA)) {
      for (const feature of PLACED) expect(flora[feature].length).toBeGreaterThan(0);
    }
  });
});

describe('speciesAt', () => {
  test('picks each species in proportion to its weight', () => {
    const list = FLORA.highlands.bush;
    const total = list.reduce((sum, s) => sum + (s.weight ?? 1), 0);
    const counts = new Map<string, number>();
    for (let hash = 0; hash < total * 100; hash++) {
      const { name } = speciesAt('highlands', 'bush', hash);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual(
      Object.fromEntries(list.map((s) => [s.name, (s.weight ?? 1) * 100])),
    );
  });

  test('only picks from the biome and feature asked for', () => {
    for (let hash = 0; hash < 200; hash++) {
      expect(FLORA.desert.bush).toContain(speciesAt('desert', 'bush', hash * 7919));
    }
  });
});
