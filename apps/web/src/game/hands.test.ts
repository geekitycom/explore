import {
  EMPTY_INVENTORY,
  bare,
  gain,
  isWalkable,
  parseInventory,
  secretGarden,
  wayIfSolid,
  type Here,
  type Inventory,
  type Item,
  type Pose,
} from '@explore/core';
import { describe, expect, test } from 'vitest';
import { aimFor, reconcileSelection } from './hands.ts';

const red: Item = { kind: 'probe', variant: 'red' };
const blue: Item = { kind: 'probe', variant: 'blue' };

const holding = (...items: Item[]): Inventory =>
  items.reduce((inv, item) => {
    const next = gain(inv, item);
    if (!next.ok) throw new Error(next.reason);
    return next.inventory;
  }, EMPTY_INVENTORY);

describe('reconcileSelection', () => {
  test('keeps the item when its stack shifts to another slot', () => {
    const shifted = parseInventory([{ ...blue, count: 1 }]);
    expect(reconcileSelection(blue, holding(red, blue))).toBe(blue);
    expect(reconcileSelection(blue, shifted)).toBe(blue);
  });

  test('clears the selection when its stack is spent', () => {
    expect(reconcileSelection(red, holding(blue))).toBeUndefined();
    expect(reconcileSelection(undefined, holding(red))).toBeUndefined();
  });
});

describe('aimFor', () => {
  const place = bare(secretGarden());
  const me: Pose = { x: 10 * 16 + 8, y: 12 * 16 + 12, dir: 'n', moving: false };
  const target = { tx: 10, ty: 11 };
  const here: Here = {
    place,
    me: { id: 1, name: 'ann', pose: me },
    others: [],
    inventory: holding(red),
    now: 0,
  };

  test('the target tile is open ground with room around it', () => {
    expect(isWalkable(place, target.tx, target.ty)).toBe(true);
    expect(wayIfSolid(place, target)).toBe('open');
  });

  test('a selected probe over an open tile in reach is valid', () => {
    expect(aimFor(here, red, target)).toEqual({ tile: target, valid: true });
  });

  test("the same tile with a player's box on it is invalid", () => {
    const bob: Pose = { x: 10 * 16 + 8, y: 11 * 16 + 10, dir: 's', moving: false };
    expect(aimFor({ ...here, others: [bob] }, red, target)).toEqual({ tile: target, valid: false });
  });

  test('a tile out of reach is invalid', () => {
    const far = { tx: 10, ty: 9 };
    expect(isWalkable(place, far.tx, far.ty)).toBe(true);
    expect(aimFor(here, red, far)).toEqual({ tile: far, valid: false });
  });

  test('no selection, no pointer, or an item no longer held aims nowhere', () => {
    expect(aimFor(here, undefined, target)).toBeUndefined();
    expect(aimFor(here, red, undefined)).toBeUndefined();
    expect(aimFor(here, blue, target)).toBeUndefined();
  });
});
