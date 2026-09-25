import { describe, expect, test } from 'vitest';
import { SCREEN_RECORD_VERSION, encodeScreen } from './codec.ts';
import { GARDEN_COORD, secretGarden } from './garden.ts';
import { biomeOf, generateScreen } from './generate.ts';
import { worldOf } from './testing.ts';
import { upgradeScreenRecord } from './upgrade.ts';
import { OVERWORLD } from './world.ts';

const world = worldOf(17);
const coord = { layer: OVERWORLD, sx: 3, sy: -2 };
const current = encodeScreen(generateScreen(world, coord));

const without = (record: object, ...keys: string[]) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));

const v3 = { ...without(current, 'biome'), v: 3 };
const v1 = { ...without(v3, 'layer'), v: 1, seed: 99 };

describe('upgradeScreenRecord', () => {
  test('lifts a record from every past version to the current one, cells untouched', () => {
    const v2 = { ...v3, v: 2, seed: 99 };
    for (const old of [v1, v2, v3]) {
      const upgraded = upgradeScreenRecord(JSON.parse(JSON.stringify(old)), world);
      expect(upgraded.v).toBe(SCREEN_RECORD_VERSION);
      expect(upgraded).toEqual(current);
      expect('seed' in upgraded).toBe(false);
    }
  });

  test('gives a v3 screen the biome the current generator assigns its position', () => {
    const upgraded = upgradeScreenRecord(v3, world);
    expect(upgraded.biome).toBe(biomeOf(world, coord));
    const gardenV3 = { ...without(encodeScreen(secretGarden()), 'biome'), v: 3 };
    expect(upgradeScreenRecord(gardenV3, world)).toEqual(encodeScreen(secretGarden()));
    expect(biomeOf(world, GARDEN_COORD)).toBe('garden');
  });

  test('returns a current record as it is', () => {
    expect(upgradeScreenRecord(current, world)).toEqual(current);
  });

  test('rejects versions it does not know and cells it cannot read', () => {
    expect(() =>
      upgradeScreenRecord({ ...current, v: SCREEN_RECORD_VERSION + 1 }, world),
    ).toThrow();
    expect(() => upgradeScreenRecord({ ...current, v: 0 }, world)).toThrow();
    expect(() => upgradeScreenRecord('{}', world)).toThrow();
    expect(() =>
      upgradeScreenRecord({ ...v3, corners: current.corners.slice(1) }, world),
    ).toThrow();
    expect(() => upgradeScreenRecord({ ...v1, sx: 'three' }, world)).toThrow();
  });
});
