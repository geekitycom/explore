import {
  BIOME_RAMPS,
  RAMPS,
  SLOTS,
  kindNamed,
  sameItem,
  slotOf,
  type Biome,
  type Hex,
  type Inventory,
  type Item,
  type RampName,
  type Slot,
  type Stack,
} from '@explore/core';
import { itemIcon } from '../art/traces.ts';
import { h } from './dom.ts';

/** The bar's height in game pixels; it scales with the view it sits under. */
export const BAR_PX_H = 40;

export type BarSlot = {
  readonly slot: Slot;
  /** The key that uses it: "1".."9", then "0". */
  readonly key: string;
  readonly stack: Stack | undefined;
  readonly selected: boolean;
};

export function barSlots(inventory: Inventory, selected: Item | undefined): BarSlot[] {
  return Array.from({ length: SLOTS }, (_, i) => {
    const stack = inventory[i];
    return {
      slot: slotOf(i)!,
      key: String((i + 1) % 10),
      stack,
      selected: stack !== undefined && selected !== undefined && sameItem(stack, selected),
    };
  });
}

/** The garden has no palette biome of its own; it is grass. */
export function groundRamp(biome: Biome): RampName {
  return biome === 'garden' ? 'grass' : BIOME_RAMPS[biome].ground[0]!;
}

export type PanelColours = { readonly dark: Hex; readonly face: Hex; readonly light: Hex };

/** The bar is carved from the biome's ground: its darkest step, a middle face, and the step above. */
export function panelColours(biome: Biome): PanelColours {
  const ramp: readonly Hex[] = RAMPS[groundRamp(biome)];
  const face = Math.floor((ramp.length - 1) / 2);
  return { dark: ramp[0]!, face: ramp[face]!, light: ramp[face + 1]! };
}

function slotView({ slot, key, stack, selected }: BarSlot): HTMLButtonElement {
  const button = h(
    'button',
    {
      type: 'button',
      class: 'slot',
      'data-slot': String(slot),
      'aria-pressed': String(selected),
      onmousedown: (event) => event.preventDefault(),
    },
    h('span', { class: 'slot-key' }, key),
  );
  if (!stack) {
    button.setAttribute('aria-label', `Slot ${key}, empty`);
    return button;
  }
  const name = kindNamed(stack.kind).carry!.name(stack.variant);
  button.title = name;
  button.setAttribute(
    'aria-label',
    `Slot ${key}, ${name}${stack.count > 1 ? `, ${stack.count}` : ''}`,
  );
  button.dataset.count = String(stack.count);
  const icon = h('canvas', { class: 'slot-icon' });
  const source = itemIcon(stack);
  icon.width = source.width;
  icon.height = source.height;
  icon.getContext('2d')!.drawImage(source, 0, 0);
  button.append(icon);
  if (stack.count > 1) button.append(h('span', { class: 'slot-count' }, String(stack.count)));
  return button;
}

/** The carved panel that closes the bottom of the game view. Redraws only when what it shows changes. */
export function inventoryBar() {
  const el = h('nav', { class: 'inventory-bar', 'aria-label': 'Inventory' });
  el.style.setProperty('--bar-px-h', String(BAR_PX_H));
  let shown: { inventory: Inventory; selected: Item | undefined; biome: Biome } | undefined;

  return {
    el,
    update(inventory: Inventory, selected: Item | undefined, biome: Biome) {
      if (shown?.biome !== biome) {
        const { dark, face, light } = panelColours(biome);
        el.style.setProperty('--bar-dark', dark);
        el.style.setProperty('--bar-face', face);
        el.style.setProperty('--bar-light', light);
      }
      if (shown?.inventory !== inventory || shown.selected !== selected)
        el.replaceChildren(...barSlots(inventory, selected).map(slotView));
      shown = { inventory, selected, biome };
    },
    /** Calls `onPick` with the slot a click lands on. */
    listen(onPick: (slot: Slot) => void): () => void {
      const click = (event: Event) => {
        const button = (event.target as Element).closest<HTMLElement>('[data-slot]');
        const slot = button && slotOf(Number(button.dataset.slot));
        if (slot !== undefined && slot !== null) onPick(slot);
      };
      el.addEventListener('click', click);
      return () => el.removeEventListener('click', click);
    },
  };
}

export type InventoryBar = ReturnType<typeof inventoryBar>;
