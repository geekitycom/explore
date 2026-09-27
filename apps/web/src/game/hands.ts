import {
  bubblesAt,
  TILE,
  facedTile,
  inReach,
  inScreen,
  promptAt,
  resolve,
  sameItem,
  slotHolding,
  stackAt,
  type ClientMessage,
  type Here,
  type ServerMessage,
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
import { MESSAGE_MS, hintText, type Hint, type Message } from './hint.ts';
import type { KeyAction } from './input.ts';
import type { GameState } from './state.ts';

export type Playing = Exclude<GameState, { phase: 'connecting' }>;

/** The tile a selected item would land on, and whether the world rules allow it. */
export type Aim = { readonly tile: Tile; readonly valid: boolean };

export type Point = { readonly x: number; readonly y: number };

/** What a press on the world does, decided once when it starts. */
export type Press =
  | { readonly kind: 'walk' }
  | { readonly kind: 'act'; readonly tile: Tile }
  | { readonly kind: 'aim'; readonly tile: Tile };

export type Hud = {
  readonly bar: InventoryBar;
  readonly hint: HTMLElement;
  /** Holds the canvas; bubbles and dialogs go in it too. */
  readonly world: HTMLElement;
};

export function hereOf(state: Playing, user: User, now: number): Here {
  return {
    place: state.place,
    me: { id: user.id, name: user.displayName, pose: state.you },
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

/**
 * A press within reach aims the selected item, or with nothing selected acts on a tile that has
 * an action. Any other press walks.
 */
export function classify(here: Here, slot: Slot | undefined, tile: Tile | undefined): Press {
  if (tile && inReach(here.me.pose, tile)) {
    if (slot !== undefined) return { kind: 'aim', tile };
    if (resolve(here, { verb: 'interact', tile }).kind !== 'nothing') return { kind: 'act', tile };
  }
  return { kind: 'walk' };
}

function tileOf({ x, y }: Point): Tile | undefined {
  const tile = { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
  return inScreen(tile.tx, tile.ty) ? tile : undefined;
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
  /** The pointer in game pixels, unclamped, so a drag past the canvas reads off the screen. */
  readonly pointAt: (event: MouseEvent) => Point;
  readonly send: (message: ClientMessage) => void;
};

/**
 * Turns keys and pointer input into interactions with the world, and keeps the hint bar and
 * inventory bar in step with the game. Predicts with `resolve` but never applies anything: the
 * server's `traces` and `inventory` messages do that.
 */
export function createHands({ hud, canvas, pointAt, send }: Options) {
  let here: Here | undefined;
  let selected: Item | undefined;
  let pointer: Tile | undefined;
  let live: { readonly id: number; readonly press: Press; point: Point } | undefined;
  let message: Message | undefined;
  let stillSince: number | undefined;
  /** The walking tip shows on idle stops until the player first walks off an edge. */
  let tip = true;
  let shown: Hint | undefined;

  const showHint = (hint: Hint | undefined) => {
    if (hint?.text === shown?.text && hint?.actionable === shown?.actionable) return;
    shown = hint;
    hud.hint.hidden = hint === undefined;
    hud.hint.textContent = hint?.text ?? '';
    hud.hint.setAttribute('aria-disabled', String(!hint?.actionable));
  };

  const select = (item: Item | undefined) => {
    selected = item;
    canvas.style.cursor = item ? cursorFor(item) : '';
  };

  const say = (text: string, now: number, forMs = MESSAGE_MS) => {
    message = { text, until: now + forMs };
    showHint({ text, actionable: false });
  };

  let suggestions = false;
  const naming = namingDialog(
    () => here,
    send,
    () => suggestions,
  );
  const composers: Partial<Record<TraceKindName, Composer>> = { landmark: naming };
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

  const slotSelected = () => (here && selected ? slotHolding(here.inventory, selected) : undefined);

  const down = (event: PointerEvent) => {
    if (event.button !== 0 || live || !here) return;
    const point = pointAt(event);
    pointer = tileOf(point);
    live = { id: event.pointerId, press: classify(here, slotSelected(), pointer), point };
    canvas.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (live && live.id !== event.pointerId) return;
    const point = pointAt(event);
    pointer = tileOf(point);
    if (live) live.point = point;
  };
  /** Touch has no hover, so its aim goes when the finger lifts. */
  const end = (event: PointerEvent) => {
    if (live?.id !== event.pointerId) return undefined;
    const { press } = live;
    live = undefined;
    if (event.pointerType !== 'mouse') pointer = undefined;
    return press;
  };
  const up = (event: PointerEvent) => {
    const press = end(event);
    const tile = tileOf(pointAt(event));
    if (!press || !tile) return;
    if (press.kind === 'act' && tile.tx === press.tile.tx && tile.ty === press.tile.ty)
      attempt({ verb: 'interact', tile });
    const slot = slotSelected();
    if (press.kind === 'aim' && slot !== undefined) attempt({ verb: 'use', slot, tile });
  };
  /** A right click deselects; a touch held long enough to open a menu does not. */
  const menu = (event: MouseEvent) => {
    event.preventDefault();
    if (!live) select(undefined);
  };
  const leave = () => {
    if (!live) pointer = undefined;
  };
  const pressHint = () => {
    if (shown?.actionable) key({ kind: 'interact' });
  };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', menu);
  canvas.addEventListener('pointerleave', leave);
  hud.hint.addEventListener('click', pressHint);
  const unlisten = hud.bar.listen(pick);

  return {
    key,
    refused,
    say,
    suggested: ({ n, suggestion }: Extract<ServerMessage, { t: 'suggestion' }>) =>
      naming.suggested(n, suggestion),
    /** Where a press on the world is walking the player to, if one is. */
    walking: (): Point | undefined => (live?.press.kind === 'walk' ? live.point : undefined),
    /** Call once per animation frame with the frame's clock. */
    frame(state: GameState, user: User, now: number): { aim: Aim | undefined } {
      if (state.phase === 'connecting' || state.phase === 'waking') {
        here = undefined;
        stillSince = undefined;
        showHint(undefined);
        bubbles.update([]);
        return { aim: undefined };
      }
      here = hereOf(state, user, Date.now());
      suggestions = state.suggestions;
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
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', end);
      canvas.removeEventListener('contextmenu', menu);
      canvas.removeEventListener('pointerleave', leave);
      hud.hint.removeEventListener('click', pressHint);
      unlisten();
      select(undefined);
      bubbles.el.remove();
      for (const composer of Object.values(composers)) composer.el.remove();
    },
  };
}
