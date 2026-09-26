import {
  bubblesAt,
  facedTile,
  promptAt,
  resolve,
  sameItem,
  slotHolding,
  stackAt,
  type ClientMessage,
  type Here,
  type Inventory,
  type Item,
  type Slot,
  type Tile,
  type TraceKindName,
} from '@explore/core';
import type { User } from '../api.ts';
import { itemIcon } from '../art/traces.ts';
import { bubbleLayer, bubbleViews, namePoint } from '../ui/bubbles.ts';
import type { InventoryBar } from '../ui/inventory-bar.ts';
import { namingDialog, type Composer } from '../ui/naming-dialog.ts';
import { hintText, type Message } from './hint.ts';
import type { KeyAction } from './input.ts';
import type { GameState } from './state.ts';

export type Playing = Exclude<GameState, { phase: 'connecting' }>;

/** The tile a selected item would land on, and whether the world rules allow it. */
export type Aim = { readonly tile: Tile; readonly valid: boolean };

export type Hud = {
  readonly bar: InventoryBar;
  readonly hint: HTMLElement;
  /** Holds the canvas; bubbles and dialogs go in it too. */
  readonly world: HTMLElement;
};

export function hereOf(state: Playing, user: User, now: number): Here {
  return {
    place: state.place,
    me: { id: user.id, name: user.username, pose: state.you },
    others: [...state.others.values()],
    inventory: state.inventory,
    now,
  };
}

/** The selection follows the item, not the slot: stacks shifting up keep it, a spent stack clears it. */
export function reconcileSelection(
  selection: Item | undefined,
  inventory: Inventory,
): Item | undefined {
  return selection && slotHolding(inventory, selection) !== undefined ? selection : undefined;
}

export function aimFor(
  here: Here,
  selected: Item | undefined,
  pointer: Tile | undefined,
): Aim | undefined {
  const slot = selected && slotHolding(here.inventory, selected);
  if (slot === undefined || pointer === undefined) return undefined;
  return {
    tile: pointer,
    valid: resolve(here, { verb: 'use', slot, tile: pointer }).kind === 'done',
  };
}

const cursors = new Map<string, string>();

/** The item's icon at twice its size, centred on the pointer. */
function cursorFor(item: Item): string {
  const key = JSON.stringify(item);
  let cursor = cursors.get(key);
  if (!cursor) {
    const icon = itemIcon(item);
    const big = document.createElement('canvas');
    big.width = icon.width * 2;
    big.height = icon.height * 2;
    const ctx = big.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(icon, 0, 0, big.width, big.height);
    cursor = `url(${big.toDataURL()}) ${icon.width} ${icon.height}, auto`;
    cursors.set(key, cursor);
  }
  return cursor;
}

type Options = {
  readonly hud: Hud;
  readonly canvas: HTMLCanvasElement;
  readonly tileAt: (event: MouseEvent) => Tile | undefined;
  readonly send: (message: ClientMessage) => void;
};

/**
 * Turns keys and pointer input into interactions with the world, and keeps the hint bar and
 * inventory bar in step with the game. Predicts with `resolve` but never applies anything: the
 * server's `traces` and `inventory` messages do that.
 */
export function createHands({ hud, canvas, tileAt, send }: Options) {
  let here: Here | undefined;
  let selected: Item | undefined;
  let pointer: Tile | undefined;
  let message: Message | undefined;
  let stillSince: number | undefined;
  /** The walking tip shows on idle stops until the player first walks off an edge. */
  let tip = true;
  let shown: string | undefined;

  const showHint = (text: string | undefined) => {
    if (text === shown) return;
    shown = text;
    hud.hint.hidden = text === undefined;
    hud.hint.textContent = text ?? '';
  };

  const select = (item: Item | undefined) => {
    selected = item;
    canvas.style.cursor = item ? cursorFor(item) : '';
  };

  const say = (text: string, now: number) => {
    message = { text, at: now };
    showHint(text);
  };

  const composers: Partial<Record<TraceKindName, Composer>> = {
    landmark: namingDialog(() => here, send),
  };
  const bubbles = bubbleLayer({
    report: ({ tile, kind }) => {
      send({ t: 'report', ...tile, kind });
      say('Reported. Thank you.', performance.now());
    },
    edit: ({ kind }) => composers[kind]?.open(),
  });
  hud.world.append(bubbles.el, ...Object.values(composers).map((c) => c.el));

  /** A refusal of a save a dialog is waiting on shows there, where the player is looking. */
  const refused = (reason: string, now: number) => {
    if (!Object.values(composers).some((c) => c.refused(reason))) say(reason, now);
  };

  /** Sends the act when the prediction allows it; a predicted refusal shows without a round trip. */
  const attempt = (
    act: { verb: 'interact'; tile: Tile } | { verb: 'use'; slot: Slot; tile: Tile },
  ) => {
    if (!here) return;
    const outcome = resolve(here, act);
    if (outcome.kind === 'nothing') return;
    if (outcome.kind === 'refused') return refused(outcome.reason, performance.now());
    const { tx, ty } = act.tile;
    send({ t: 'move', ...here.me.pose });
    send(act.verb === 'use' ? { t: 'use', slot: act.slot, tx, ty } : { t: 'interact', tx, ty });
  };

  const key = (action: KeyAction) => {
    if (action.kind === 'cancel') return select(undefined);
    if (!here) return;
    const prompt = action.kind === 'interact' ? promptAt(here) : undefined;
    if (prompt?.kind === 'offer') return composers[prompt.compose]?.open();
    const tile = facedTile(here.me.pose);
    if (!tile) return;
    if (action.kind === 'interact') attempt({ verb: 'interact', tile });
    else attempt({ verb: 'use', slot: action.slot, tile });
  };

  const pick = (slot: Slot) => {
    const stack = here && stackAt(here.inventory, slot);
    select(stack && !(selected && sameItem(stack, selected)) ? stack : undefined);
  };

  const click = (event: MouseEvent) => {
    const tile = tileAt(event);
    const slot = here && selected && slotHolding(here.inventory, selected);
    if (tile && slot !== undefined) attempt({ verb: 'use', slot, tile });
  };
  const cancel = (event: MouseEvent) => {
    event.preventDefault();
    select(undefined);
  };
  const move = (event: MouseEvent) => {
    pointer = tileAt(event);
  };
  const leave = () => {
    pointer = undefined;
  };

  canvas.addEventListener('click', click);
  canvas.addEventListener('contextmenu', cancel);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerleave', leave);
  const unlisten = hud.bar.listen(pick);

  return {
    key,
    refused,
    /** Call once per animation frame with the frame's clock. */
    frame(state: GameState, user: User, now: number): { aim: Aim | undefined } {
      if (state.phase === 'connecting') {
        here = undefined;
        stillSince = undefined;
        showHint(undefined);
        bubbles.update([]);
        return { aim: undefined };
      }
      here = hereOf(state, user, Date.now());
      for (const composer of Object.values(composers)) composer.sync(here);
      bubbles.update(
        bubbleViews(bubblesAt(here), {
          id: user.id,
          pose: state.you,
          names: [
            namePoint(state.you.x, state.you.y),
            ...[...state.others.values()].map((p) => namePoint(p.drawX, p.drawY)),
          ],
          editable: (kind) => kind in composers,
        }),
      );
      const playing = state.phase === 'playing';
      if (!playing) tip = false;
      stillSince = playing && !state.you.moving ? (stillSince ?? now) : undefined;

      const kept = reconcileSelection(selected, state.inventory);
      if (kept !== selected) select(kept);
      hud.bar.update(state.inventory, selected, state.place.screen.biome);

      const prompt = playing && stillSince !== undefined ? promptAt(here) : undefined;
      showHint(hintText({ now, stillSince, message, prompt, tip }));
      return { aim: playing ? aimFor(here, selected, pointer) : undefined };
    },
    dispose() {
      canvas.removeEventListener('click', click);
      canvas.removeEventListener('contextmenu', cancel);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerleave', leave);
      unlisten();
      select(undefined);
      bubbles.el.remove();
      for (const composer of Object.values(composers)) composer.el.remove();
    },
  };
}
