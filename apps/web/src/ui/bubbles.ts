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

type BubbleSide = 'above' | 'below';

/** Where a bubble sits over the world, as percentages of it, and what its buttons do. */
export type BubbleView = {
  readonly said: Said;
  readonly key: string;
  /** The tip of the tail, on the edge of the trace's tile that faces the bubble. */
  readonly left: number;
  readonly top: number;
  readonly side: BubbleSide;
  /** Which part of the bubble sits over the trace, so one near an edge stays in view. */
  readonly anchor: 'start' | 'middle' | 'end';
  readonly actions: readonly BubbleAction[];
};

/** Tiles from the edge within which a bubble stops centring on its trace. */
const EDGE = 3;
/** World pixels kept between a bubble and a name; the gap between the two sides fits a name. */
const GAP = 2;
/** Generous world-pixel sizes of a name drawn over a head and of a bubble, to keep them apart. */
const NAME_H = 10;
const BUBBLE_H = 2.5 * TILE;
const BUBBLE_HALF_W = 5 * TILE;
const SIDES: readonly BubbleSide[] = ['above', 'below'];

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
 * It sits above its trace with the tail pointing down at it, or below with the tail pointing up
 * when above would cover a name or leave the view. With no side clear of every name it keeps
 * the reader's own name clear. Anyone may report someone else's words, and anyone may rewrite
 * the words of a kind that allows it, such as a landmark's name.
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
  const actions: BubbleAction[] = [
    ...(reader.editable(s.kind) ? (['edit'] as const) : []),
    ...(by && by.id !== reader.id ? (['report'] as const) : []),
  ];
  const x = (tx + 0.5) * TILE;
  const tip: Record<BubbleSide, number> = { above: ty * TILE, below: (ty + 1) * TILE };
  const span = (side: BubbleSide) =>
    side === 'above'
      ? { top: tip.above - BUBBLE_H, bottom: tip.above }
      : { top: tip.below, bottom: tip.below + BUBBLE_H };
  const inView = (side: BubbleSide) => span(side).top >= 0 && span(side).bottom <= SCREEN_PX_H;
  const clearOf = (names: readonly NamePoint[]) => (side: BubbleSide) => {
    const { top, bottom } = span(side);
    return names.every(
      (name) =>
        Math.abs(name.x - x) >= BUBBLE_HALF_W ||
        name.y + GAP <= top ||
        name.y - NAME_H - GAP >= bottom,
    );
  };
  const shown = SIDES.filter(inView);
  const side =
    shown.find(clearOf(reader.names)) ??
    shown.find(clearOf([namePoint(reader.pose.x, reader.pose.y)])) ??
    shown[0]!;
  return [
    {
      said: s,
      key: JSON.stringify([s.tile, s.kind, s.bubble]),
      left: (x / SCREEN_PX_W) * 100,
      top: (tip[side] / SCREEN_PX_H) * 100,
      side,
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

const LABELS: Record<BubbleAction, string> = { report: 'Report', edit: 'Rename' };

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
      { class: `bubble bubble-${view.anchor} bubble-${view.side}`, role: 'note' },
      h('p', { class: 'bubble-text' }, text),
      ...(line ? [h('p', { class: 'bubble-line' }, line)] : []),
      ...(by || buttons.length > 0
        ? [
            h(
              'p',
              { class: 'bubble-by' },
              h('span', {}, by ? `${view.said.bubble.credit ?? 'by'} ${by.name}` : ''),
              ...buttons,
            ),
          ]
        : []),
    );
    node.style.left = `${view.left}%`;
    if (view.side === 'above') node.style.bottom = `${100 - view.top}%`;
    else node.style.top = `${view.top}%`;
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
