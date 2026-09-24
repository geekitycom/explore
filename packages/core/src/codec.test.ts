import { describe, expect, test } from 'vitest';
import { decodeScreen, encodeScreen } from './codec.ts';
import { uniformScreen, withCorners, withFeatures } from './testing.ts';

describe('screen codec', () => {
  const screen = withFeatures(
    withCorners(uniformScreen('grass'), [
      [3, 4, 'water'],
      [20, 15, 'sand'],
    ]),
    [
      [0, 0, 'tree'],
      [19, 14, 'flowers'],
    ],
  );

  test('round-trips every cell', () => {
    const record = encodeScreen({ ...screen, coord: { sx: -3, sy: 7 }, seed: 42 });
    expect(record.corners[4 * 21 + 3]).toBe('w');
    expect(decodeScreen(JSON.parse(JSON.stringify(record)))).toEqual({
      ...screen,
      coord: { sx: -3, sy: 7 },
      seed: 42,
    });
  });

  test('rejects wrong length, unknown codes, and unknown versions', () => {
    const record = encodeScreen(screen);
    expect(() => decodeScreen({ ...record, corners: record.corners.slice(1) })).toThrow();
    expect(() => decodeScreen({ ...record, features: 'X' + record.features.slice(1) })).toThrow(
      /unknown cell code/,
    );
    expect(() => decodeScreen({ ...record, v: 2 })).toThrow();
  });
});
