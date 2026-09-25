import { GARDEN_COORD, OVERWORLD, secretGarden, type LayerId } from '@explore/core';
import { uniformScreen, withCorners, withFeatures } from '@explore/core/testing';
import { describe, expect, test } from 'vitest';
import { screenMood, tuneFor } from './mood.ts';

const at = (sx: number, sy: number) => ({
  ...uniformScreen(),
  coord: { layer: OVERWORLD, sx, sy },
});

describe('screenMood', () => {
  test('the garden has its own mood', () => {
    expect(screenMood(secretGarden())).toBe('garden');
    const cellar = { ...GARDEN_COORD, layer: 'cellar' as LayerId };
    expect(screenMood({ ...secretGarden(), coord: cellar })).not.toBe('garden');
  });

  test('water-heavy screens are lakes and tree-heavy screens are forests', () => {
    const water = Array.from({ length: 120 }, (_, i): [number, number, 'water'] => [
      i % 21,
      Math.floor(i / 21),
      'water',
    ]);
    expect(screenMood(withCorners(at(3, 3), water))).toBe('lake');
    const trees = Array.from({ length: 70 }, (_, i): [number, number, 'tree'] => [
      i % 20,
      Math.floor(i / 20),
      'tree',
    ]);
    expect(screenMood(withFeatures(at(3, 3), trees))).toBe('forest');
    expect(screenMood(at(3, 3))).toBe('meadow');
  });
});

describe('tuneFor', () => {
  test('same mood in the same block shares a tune; another block gets another', () => {
    expect(tuneFor(at(4, 4)).key).toBe(tuneFor(at(7, 5)).key);
    expect(tuneFor(at(4, 4)).key).not.toBe(tuneFor(at(8, 4)).key);
    expect(tuneFor(at(-1, 0)).key).not.toBe(tuneFor(at(0, 1)).key);
  });
});
