import {
  EMPTY_INVENTORY,
  bare,
  gain,
  isWalkable,
  parseInventory,
  placeOf,
  secretGarden,
  slotOf,
  wayIfSolid,
  type Here,
  type Inventory,
  type Item,
  type Pose,
} from '@explore/core';
import { uniformScreen } from '@explore/core/testing';
import { describe, expect, test } from 'vitest';
import { aimFor, classify, reconcileSelection } from './hands.ts';

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

describe('classify', () => {
  /** Centre tile (10, 7); a probe lies on (11, 7), beside it, and on (13, 7), out of reach. */
  const me: Pose = { x: 168, y: 122, dir: 'e', moving: false };
  const probe = { tx: 11, ty: 7 };
  const farProbe = { tx: 13, ty: 7 };
  const grass = { tx: 10, ty: 8 };
  const here: Here = {
    place: placeOf(uniformScreen(), [
      { kind: 'probe', ...probe, by: 3 },
      { kind: 'probe', ...farProbe, by: 3 },
    ]),
    me: { id: 1, name: 'ann', pose: me },
    others: [],
    inventory: holding(red),
    now: 0,
  };
  const slot = slotOf(0)!;

  test('with nothing selected, a press on a thing in reach acts on it', () => {
    expect(classify(here, undefined, probe)).toEqual({ kind: 'act', tile: probe });
  });

  test('with nothing selected, a press on empty ground or out of reach walks', () => {
    expect(classify(here, undefined, grass)).toEqual({ kind: 'walk' });
    expect(classify(here, undefined, farProbe)).toEqual({ kind: 'walk' });
    expect(classify(here, undefined, undefined)).toEqual({ kind: 'walk' });
  });

  test('with an item selected, a press in reach aims at that tile, on a thing or not', () => {
    expect(classify(here, slot, grass)).toEqual({ kind: 'aim', tile: grass });
    expect(classify(here, slot, probe)).toEqual({ kind: 'aim', tile: probe });
  });

  test('with an item selected, a press out of reach or off the screen walks', () => {
    expect(classify(here, slot, farProbe)).toEqual({ kind: 'walk' });
    expect(classify(here, slot, { tx: 10, ty: 3 })).toEqual({ kind: 'walk' });
    expect(classify(here, slot, undefined)).toEqual({ kind: 'walk' });
  });
});
