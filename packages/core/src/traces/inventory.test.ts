import { describe, expect, test } from 'vitest';
import {
  EMPTY_INVENTORY,
  NO_FREE_SLOT,
  SLOTS,
  gain,
  parseInventory,
  slotOf,
  spend,
  type Inventory,
} from './inventory.ts';
import type { Item } from './registry.ts';

const probe = (variant: string): Item => ({ kind: 'probe', variant });

function gainAll(items: Item[], from: Inventory = EMPTY_INVENTORY): Inventory {
  return items.reduce((inv, item) => {
    const result = gain(inv, item);
    if (!result.ok) throw new Error(result.reason);
    return result.inventory;
  }, from);
}

describe('gain', () => {
  test('stacks the same kind and variant, and gives a new variant its own slot', () => {
    expect(gainAll([probe('red'), probe('red')])).toEqual([
      { kind: 'probe', variant: 'red', count: 2 },
    ]);
    expect(gainAll([probe('red'), probe('blue')])).toEqual([
      { kind: 'probe', variant: 'red', count: 1 },
      { kind: 'probe', variant: 'blue', count: 1 },
    ]);
  });

  test("refuses at the kind's carry limit, counted across variants, with the kind's text", () => {
    const full = gainAll([probe('red'), probe('blue')]);
    expect(gain(full, probe('red'))).toEqual({ ok: false, reason: 'You can only carry 2 probes.' });
    expect(gain(full, probe('green'))).toEqual({
      ok: false,
      reason: 'You can only carry 2 probes.',
    });
  });

  test('refuses a new stack when every slot is taken', () => {
    const packed = parseInventory(
      Array.from({ length: SLOTS }, (_, i) => ({ ...probe(`p${i}`), count: 1 })),
    );
    expect(packed).toHaveLength(SLOTS);
    expect(gain(packed, probe('new'))).toEqual({ ok: false, reason: NO_FREE_SLOT });
  });
});

describe('spend', () => {
  test('takes one from the slot and keeps the stack while any are left', () => {
    const inv = gainAll([probe('red'), probe('red')]);
    expect(spend(inv, slotOf(0)!)).toEqual([{ kind: 'probe', variant: 'red', count: 1 }]);
  });

  test('removes an emptied stack so the stacks after it shift up', () => {
    const inv = parseInventory([
      { ...probe('a'), count: 1 },
      { ...probe('b'), count: 1 },
      { ...probe('c'), count: 1 },
    ]);
    expect(spend(inv, slotOf(1)!).map((s) => s.variant)).toEqual(['a', 'c']);
  });
});

describe('parseInventory', () => {
  test('drops unknown kinds and bad stacks, and merges duplicates in first-seen order', () => {
    expect(
      parseInventory([
        { kind: 'dragon', variant: 'red', count: 1 },
        { ...probe('b'), count: 2 },
        { ...probe('a'), count: 0 },
        { ...probe('a'), count: 1 },
        { ...probe('b'), count: 1 },
      ]),
    ).toEqual([
      { kind: 'probe', variant: 'b', count: 3 },
      { kind: 'probe', variant: 'a', count: 1 },
    ]);
  });

  test('keeps only the first SLOTS stacks, and reads anything else as empty', () => {
    const many = Array.from({ length: SLOTS + 2 }, (_, i) => ({ ...probe(`p${i}`), count: 1 }));
    expect(parseInventory(many).map((s) => s.variant)).toEqual(
      many.slice(0, SLOTS).map((s) => s.variant),
    );
    expect(parseInventory('garbage')).toEqual([]);
    expect(parseInventory(null)).toEqual([]);
  });
});

test('slotOf accepts 0 through 9 only', () => {
  expect([-1, 0, 9, 10, 1.5].map(slotOf)).toEqual([undefined, 0, 9, undefined, undefined]);
});
