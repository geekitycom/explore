import { z } from 'zod';
import { refuse, type Refusal } from './kind.ts';
import { LIMITS, itemSchema, kindNamed, type Item } from './registry.ts';

export const SLOTS = 10;

/** 0..9, on keys "1".."9" then "0". */
export type Slot = number & { readonly __brand: 'Slot' };
export type Stack = Item & { readonly count: number };
/** Slot order, at most SLOTS stacks, no two of the same item. */
export type Inventory = readonly Stack[] & { readonly __brand: 'Inventory' };

export const NO_FREE_SLOT = 'Your hands are full.';

const inventoryOf = (stacks: readonly Stack[]) => stacks as Inventory;

export const EMPTY_INVENTORY = inventoryOf([]);

export function slotOf(index: number): Slot | undefined {
  return Number.isInteger(index) && index >= 0 && index < SLOTS ? (index as Slot) : undefined;
}

export function stackAt(inventory: Inventory, slot: Slot): Stack | undefined {
  return inventory[slot];
}

export function sameItem(a: Item, b: Item): boolean {
  return a.kind === b.kind && JSON.stringify(a.variant) === JSON.stringify(b.variant);
}

export function slotHolding(inventory: Inventory, item: Item): Slot | undefined {
  const index = inventory.findIndex((s) => sameItem(s, item));
  return index === -1 ? undefined : slotOf(index);
}

/** One more of `item`. The kind's carry limit counts every variant of the kind together. */
export function gain(
  inventory: Inventory,
  item: Item,
): { readonly ok: true; readonly inventory: Inventory } | Refusal {
  const slot = slotHolding(inventory, item);
  if (slot === undefined && inventory.length >= SLOTS) return refuse(NO_FREE_SLOT);
  const carry = LIMITS[item.kind].carry;
  const held = inventory.reduce((n, s) => (s.kind === item.kind ? n + s.count : n), 0);
  if (carry !== undefined && held >= carry) return refuse(kindNamed(item.kind).carry!.full);
  const stacks =
    slot === undefined
      ? [...inventory, { ...item, count: 1 }]
      : inventory.map((s, i) => (i === slot ? { ...s, count: s.count + 1 } : s));
  return { ok: true, inventory: inventoryOf(stacks) };
}

/** One fewer from the slot. An emptied stack is removed and later stacks shift up. */
export function spend(inventory: Inventory, slot: Slot): Inventory {
  return inventoryOf(
    inventory.flatMap((s, i) =>
      i !== slot ? [s] : s.count > 1 ? [{ ...s, count: s.count - 1 }] : [],
    ),
  );
}

const stackSchema = z.intersection(itemSchema, z.object({ count: z.number().int().min(1) }));

export const inventorySchema = z.array(stackSchema);

/** Drops stacks whose kind or variant no longer parses, merges duplicates, keeps the first SLOTS. */
export function parseInventory(raw: unknown): Inventory {
  const list = z.array(z.unknown()).safeParse(raw);
  if (!list.success) return EMPTY_INVENTORY;
  const stacks: Stack[] = [];
  for (const entry of list.data) {
    const parsed = stackSchema.safeParse(entry);
    if (!parsed.success) continue;
    const at = stacks.findIndex((s) => sameItem(s, parsed.data));
    if (at === -1) stacks.push(parsed.data);
    else stacks[at] = { ...stacks[at]!, count: stacks[at]!.count + parsed.data.count };
  }
  return inventoryOf(stacks.slice(0, SLOTS));
}
