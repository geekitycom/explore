import {
  EMPTY_INVENTORY,
  RAMPS,
  gain,
  spend,
  slotOf,
  type Inventory,
  type Item,
} from '@explore/core';
import { describe, expect, test } from 'vitest';
import { barSlots, panelColours } from './inventory-bar.ts';

const red: Item = { kind: 'probe', variant: 'red' };
const blue: Item = { kind: 'probe', variant: 'blue' };

const holding = (...items: Item[]): Inventory =>
  items.reduce((inv, item) => {
    const next = gain(inv, item);
    if (!next.ok) throw new Error(next.reason);
    return next.inventory;
  }, EMPTY_INVENTORY);

describe('barSlots', () => {
  test('always ten slots, keyed 1 to 9 then 0', () => {
    const slots = barSlots(EMPTY_INVENTORY, undefined);
    expect(slots.map((s) => s.key)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
    expect(slots.every((s) => s.stack === undefined && !s.selected)).toBe(true);
  });

  test('stacks fill from the first slot and the selected item is marked', () => {
    const slots = barSlots(holding(red, blue), blue);
    expect(slots.map((s) => s.stack?.variant)).toEqual([
      'red',
      'blue',
      ...Array<undefined>(8).fill(undefined),
    ]);
    expect(slots.map((s) => s.selected)).toEqual([false, true, ...Array<boolean>(8).fill(false)]);
  });

  test('stacks shift up when one runs out', () => {
    const after = spend(holding(red, blue), slotOf(0)!);
    const slots = barSlots(after, blue);
    expect(slots[0]).toMatchObject({ key: '1', stack: { ...blue, count: 1 }, selected: true });
    expect(slots[1]!.stack).toBeUndefined();
  });
});

describe('panelColours', () => {
  test('the garden is carved from grass', () => {
    const [dark, , face, light] = RAMPS.grass;
    expect(panelColours('garden')).toEqual({ dark, face, light });
  });

  test('a biome is carved from its first ground ramp, darkest step first', () => {
    expect(panelColours('taiga').dark).toBe(RAMPS.snow[0]);
    expect(panelColours('desert').dark).toBe(RAMPS.dune[0]);
  });
});
