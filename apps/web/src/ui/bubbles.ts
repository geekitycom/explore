import {
  SCREEN_PX_H,
  SCREEN_PX_W,
  SCREEN_W,
  TILE,
  centreTile,
  facedTile,
  type Pose,
  type Said,
  type Tile,
} from '@explore/core';
import { h } from './dom.ts';

export type BubbleAction = 'report' | 'edit';

/** Where a bubble sits over the world, as percentages of it, and what its buttons do. */
export type BubbleView = {
  readonly said: Said;
  readonly key: string;
  readonly left: number;
  readonly bottom: number;
  /** Which part of the bubble sits over the trace, so one near an edge stays in view. */
  readonly anchor: 'start' | 'middle' | 'end';
  readonly actions: readonly BubbleAction[];
};

/** Tiles from the edge within which a bubble stops centring on its trace. */
const EDGE = 3;
/** World pixels between a bubble's tail and what it clears: its trace's tile, or a name. */
const GAP = 4;
/** Generous world-pixel sizes of a name drawn over a head and of a bubble, to keep them apart. */
const NAME_H = 10;
const BUBBLE_H = 2.5 * TILE;
const BUBBLE_HALF_W = 5 * TILE;

export type NamePoint = { readonly x: number; readonly y: number };

/** Where a player's name is drawn up from: centred on them, a tile above their feet. */
export const namePoint = (x: number, y: number): NamePoint => ({ x, y: y - TILE });

type Reader = {
  readonly id: number;
  readonly pose: Pose;
  /** Every player's name over the world, the reader's own included. */
  readonly names: readonly NamePoint[];
  readonly editable: (kind: Said['kind']) => boolean;
};

const offset = (pose: Pose, { tx, ty }: Tile) => {
  const at = centreTile(pose);
  return Math.abs(tx - at.tx) + Math.abs(ty - at.ty);
};

/**
 * One bubble at a time, so bubbles never cover each other: the faced trace's, else the nearest.
 * It rises from just above its tile, or from just above a name, whichever is lowest and covers
 * no name. With no such room it stays over its tile. Anyone may report someone else's words;
 * their author may edit them where a kind allows it.
 */
export function bubbleViews(said: readonly Said[], reader: Reader): BubbleView[] {
  const faced = facedTile(reader.pose);
  const s = [...said].sort(
    (a, b) =>
      Number(sameTile(b.tile, faced)) - Number(sameTile(a.tile, faced)) ||
      offset(reader.pose, a.tile) - offset(reader.pose, b.tile),
  )[0];
  if (!s) return [];
  const { tx, ty } = s.tile;
  const { by } = s.bubble;
  const actions: BubbleAction[] =
    by === undefined
      ? []
      : by.id === reader.id
        ? reader.editable(s.kind)
          ? ['edit']
          : []
        : ['report'];
  const x = (tx + 0.5) * TILE;
  const near = reader.names.filter((name) => Math.abs(name.x - x) < BUBBLE_HALF_W);
  const clear = (base: number) =>
    near.every((name) => name.y <= base - BUBBLE_H || name.y - NAME_H >= base);
  const lowest = ty * TILE - GAP;
  const base =
    [lowest, ...near.map((name) => name.y - NAME_H - GAP)]
      .filter((b) => b <= lowest && b >= BUBBLE_H)
      .sort((a, b) => b - a)
      .find(clear) ?? lowest;
  return [
    {
      said: s,
      key: JSON.stringify([s.tile, s.kind, s.bubble]),
      left: (x / SCREEN_PX_W) * 100,
      bottom: (1 - base / SCREEN_PX_H) * 100,
      anchor: tx < EDGE ? 'start' : tx >= SCREEN_W - EDGE ? 'end' : 'middle',
      actions,
    },
  ];
}

const sameTile = (a: Tile, b: Tile | undefined) => a.tx === b?.tx && a.ty === b.ty;

type Handlers = {
  readonly report: (said: Said) => void;
  readonly edit: (said: Said) => void;
};

const LABELS: Record<BubbleAction, string> = { report: 'Report', edit: 'Edit' };

/**
 * Speech bubbles over the world for the traces in reach: the words, a second line, who left
 * them, and a button to report or edit them. Rebuilt only when what they say changes.
 */
export function bubbleLayer(handlers: Handlers) {
  const el = h('div', { class: 'bubbles' });
  const reported = new Set<string>();
  let shown = '';

  const bubble = (view: BubbleView) => {
    const { text, line, by } = view.said.bubble;
    const buttons = view.actions.map((action) => {
      const done = action === 'report' && reported.has(view.key);
      return h(
        'button',
        {
          type: 'button',
          class: 'link',
          disabled: done,
          onclick: () => {
            if (action === 'edit') return handlers.edit(view.said);
            reported.add(view.key);
            shown = '';
            handlers.report(view.said);
          },
        },
        done ? 'Reported' : LABELS[action],
      );
    });
    const node = h(
      'div',
      { class: `bubble bubble-${view.anchor}`, role: 'note' },
      h('p', { class: 'bubble-text' }, text),
      ...(line ? [h('p', { class: 'bubble-line' }, line)] : []),
      ...(by
        ? [
            h(
              'p',
              { class: 'bubble-by' },
              h('span', {}, `${view.said.bubble.credit ?? 'by'} ${by.name}`),
              ...buttons,
            ),
          ]
        : []),
    );
    node.style.left = `${view.left}%`;
    node.style.bottom = `${view.bottom}%`;
    return node;
  };

  return {
    el,
    update(views: readonly BubbleView[]) {
      const key = JSON.stringify(views.map((v) => [v.key, v.actions]));
      if (key === shown) return;
      shown = key;
      el.replaceChildren(...views.map(bubble));
    },
  };
}

export type BubbleLayer = ReturnType<typeof bubbleLayer>;
