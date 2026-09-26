import { EMPTY_INVENTORY, placeOf, type Here, type Trace } from '@explore/core';
import { uniformScreen } from '@explore/core/testing';
import { describe, expect, test } from 'vitest';
import { namingShown } from './naming-dialog.ts';

const ANN = { id: 1, name: 'ann' };
const SITE = {
  kind: 'landmark',
  tx: 10,
  ty: 7,
  poi: 'stones',
  area: { x: 10.5, y: 7.5, rx: 4, ry: 3 },
} as const;
const OLD = { name: 'Old Stones', by: ANN, at: 1 };

const here = (site: Trace): Here => ({
  place: placeOf(uniformScreen(), [site]),
  me: { ...ANN, pose: { x: 168, y: 142, dir: 'n', moving: false } },
  others: [],
  inventory: EMPTY_INVENTORY,
  now: 2,
});

describe('namingShown', () => {
  test('waits until the landmark reads as the save predicted, whenever it landed', () => {
    const want = { ...OLD, line: 'Hares', at: 2 };
    expect(namingShown(want, here({ ...SITE, named: OLD }))).toBe(false);
    expect(namingShown(want, here({ ...SITE, named: { ...OLD, line: 'Hares', at: 9 } }))).toBe(
      true,
    );
    expect(
      namingShown(want, here({ ...SITE, named: { ...want, by: { id: 2, name: 'ann' } } })),
    ).toBe(false);
  });

  test('a clear shows once the name is gone', () => {
    expect(namingShown(undefined, here({ ...SITE, named: OLD }))).toBe(false);
    expect(namingShown(undefined, here(SITE))).toBe(true);
  });
});
