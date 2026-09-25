import { describe, expect, test } from 'vitest';
import { decodeScreen, encodeScreen } from './codec.ts';
import type { LayerId } from './world.ts';
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
    const coord = { layer: 'cellar' as LayerId, sx: -3, sy: 7 };
    const record = encodeScreen({ ...screen, coord });
    expect(record).toMatchObject({ v: 3, layer: 'cellar', sx: -3, sy: 7 });
    expect(record.corners[4 * 21 + 3]).toBe('w');
    expect(decodeScreen(JSON.parse(JSON.stringify(record)))).toEqual({ ...screen, coord });
  });

  test('rejects wrong length, unknown codes, unknown versions, and a missing layer', () => {
    const record = encodeScreen(screen);
    expect(() => decodeScreen({ ...record, corners: record.corners.slice(1) })).toThrow();
    expect(() => decodeScreen({ ...record, features: 'X' + record.features.slice(1) })).toThrow(
      /unknown cell code/,
    );
    expect(() => decodeScreen({ ...record, v: 2 })).toThrow();
    expect(() => decodeScreen({ ...record, layer: '' })).toThrow();
    expect(() => decodeScreen({ ...record, layer: undefined })).toThrow();
  });
});
