import { describe, expect, test } from 'vitest';
import { canOccupy, isTileWalkable } from './walk.ts';
import { uniformScreen, withCorners, withFeatures } from './testing.ts';

describe('isTileWalkable', () => {
  test('blocking features block, decorative ones do not', () => {
    const s = withFeatures(uniformScreen(), [
      [1, 1, 'tree'],
      [2, 1, 'bush'],
      [3, 1, 'rock'],
      [4, 1, 'flowers'],
      [5, 1, 'tallgrass'],
    ]);
    expect([1, 2, 3, 4, 5].map((tx) => isTileWalkable(s, tx, 1))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  test('a tile is water-blocked only with 3 or 4 water corners', () => {
    const two = withCorners(uniformScreen(), [
      [5, 5, 'water'],
      [6, 5, 'water'],
    ]);
    const three = withCorners(two, [[5, 6, 'water']]);
    expect(isTileWalkable(two, 5, 5)).toBe(true);
    expect(isTileWalkable(three, 5, 5)).toBe(false);
    expect(isTileWalkable(uniformScreen('water'), 0, 0)).toBe(false);
  });
});

describe('canOccupy', () => {
  const s = withFeatures(uniformScreen(), [[5, 5, 'rock']]);

  test('feet overlapping a blocked tile cannot stand there', () => {
    expect(canOccupy(s, 5 * 16 + 8, 5 * 16 + 8)).toBe(false);
    expect(canOccupy(s, 5 * 16 - 5, 5 * 16 + 8)).toBe(true);
    expect(canOccupy(s, 5 * 16 - 4, 5 * 16 + 8)).toBe(false);
  });

  test('the body may overlap the tile above the feet', () => {
    expect(canOccupy(s, 5 * 16 + 8, 6 * 16 + 4)).toBe(true);
    expect(canOccupy(s, 5 * 16 + 8, 6 * 16 + 3)).toBe(false);
  });

  test('past the screen edge counts as open', () => {
    expect(canOccupy(uniformScreen('water'), -10, -10)).toBe(true);
    expect(canOccupy(uniformScreen('water'), 1, 100)).toBe(false);
  });
});
