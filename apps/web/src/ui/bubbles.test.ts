import {
  SCREEN_H,
  SCREEN_PX_H,
  SCREEN_PX_W,
  SCREEN_W,
  TILE,
  type Pose,
  type Said,
} from '@explore/core';
import { describe, expect, test } from 'vitest';
import { bubbleViews, namePoint, type BubbleView, type NamePoint } from './bubbles.ts';

const ANN = { id: 1, name: 'ann' };
const said = (tx: number, ty = 5, by?: typeof ANN): Said => ({
  tile: { tx, ty },
  kind: 'landmark',
  bubble: { text: `at ${tx},${ty}`, ...(by ? { by } : {}) },
});
/** Standing on tile (tx, ty) facing north. */
const on = (tx: number, ty: number, dir: Pose['dir'] = 'n'): Pose => ({
  x: (tx + 0.5) * TILE,
  y: (ty + 1) * TILE - 2,
  dir,
  moving: false,
});
const reader = (pose: Pose, id = 2, names: NamePoint[] = [namePoint(pose.x, pose.y)]) => ({
  id,
  pose,
  names,
  editable: () => true,
});

describe('bubbleViews', () => {
  test("offers a report on someone else's words and an edit on your own", () => {
    const me = on(10, 6);
    expect(bubbleViews([said(10, 5, ANN)], reader(me))[0]!.actions).toEqual(['report']);
    expect(bubbleViews([said(10, 5, ANN)], reader(me, 1))[0]!.actions).toEqual(['edit']);
    expect(
      bubbleViews([said(10, 5, ANN)], { ...reader(me, 1), editable: () => false })[0]!.actions,
    ).toEqual([]);
    expect(bubbleViews([said(10, 5)], reader(me))[0]!.actions).toEqual([]);
  });

  test('shows one bubble at a time: the faced trace, else the nearest', () => {
    const traces = [said(9, 5), said(11, 6), said(10, 5)];
    expect(bubbleViews(traces, reader(on(10, 6)))[0]!.said.tile).toEqual({ tx: 10, ty: 5 });
    expect(bubbleViews(traces, reader(on(10, 6, 'e')))[0]!.said.tile).toEqual({ tx: 11, ty: 6 });
    expect(bubbleViews([said(9, 5), said(11, 7)], reader(on(10, 7, 's')))[0]!.said.tile).toEqual({
      tx: 11,
      ty: 7,
    });
    expect(bubbleViews([], reader(on(10, 6)))).toEqual([]);
  });

  test('keeps its body on screen near a side edge', () => {
    const anchor = (tx: number) => bubbleViews([said(tx)], reader(on(tx, 6)))[0]!.anchor;
    expect([anchor(0), anchor(10), anchor(19)]).toEqual(['start', 'middle', 'end']);
  });

  const viewOf = (trace: Said, pose: Pose, names = [namePoint(pose.x, pose.y)]) =>
    bubbleViews([trace], reader(pose, 2, names))[0]!;
  const px = (percent: number, of: number) => Math.round((percent / 100) * of * 1000) / 1000;
  const tipOf = (view: BubbleView) => ({
    x: px(view.left, SCREEN_PX_W),
    y: px(view.top, SCREEN_PX_H),
  });
  const onTile = (view: BubbleView) => {
    const { x, y } = tipOf(view);
    const { tx, ty } = view.said.tile;
    return x > tx * TILE && x < (tx + 1) * TILE && y >= ty * TILE && y <= (ty + 1) * TILE;
  };
  /** The world rows a bubble covers: 40 pixels up or down from its tail, 80 either side. */
  const box = (view: BubbleView) => {
    const { x, y } = tipOf(view);
    return view.side === 'above' ? { x, top: y - 40, bottom: y } : { x, top: y, bottom: y + 40 };
  };
  /** A name covers the world rows from ten pixels above its point down to it. */
  const covers = (view: BubbleView, name: NamePoint) => {
    const { x, top, bottom } = box(view);
    return Math.abs(name.x - x) < 80 && name.y > top && name.y - 10 < bottom;
  };
  const inView = (view: BubbleView) => box(view).top >= 0 && box(view).bottom <= SCREEN_PX_H;

  test('the bubble of the grave below the reader points at that grave', () => {
    const view = bubbleViews([said(10, 7), said(10, 5)], reader(on(10, 6, 's')))[0]!;
    expect(view.said.tile).toEqual({ tx: 10, ty: 7 });
    expect(onTile(view)).toBe(true);
    expect(view.side).toBe('below');
  });

  test('sits above its trace, below it when the reader stands above or beside', () => {
    const grave = said(10, 7);
    const side = (pose: Pose) => viewOf(grave, pose).side;
    expect(side(on(10, 8, 'n'))).toBe('above');
    expect(side(on(10, 6, 's'))).toBe('below');
    expect(side(on(9, 7, 'e'))).toBe('below');
    expect(side(on(11, 7, 'w'))).toBe('below');
    expect(side(on(10, 11, 'n'))).toBe('above');
  });

  test("points its tail at its trace's tile from every tile around it, in view", () => {
    const around = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy] as const));
    for (let ty = 0; ty < SCREEN_H; ty++)
      for (let tx = 0; tx < SCREEN_W; tx++)
        for (const [dx, dy] of around) {
          if (dx === 0 && dy === 0) continue;
          const pose = on(tx + dx, ty + dy);
          const view = viewOf(said(tx, ty), pose);
          const where = `trace ${tx},${ty}, reader ${dx},${dy}, ${view.side}`;
          expect(onTile(view), where).toBe(true);
          expect(inView(view), where).toBe(true);
          const room = ty > 2 && ty < SCREEN_H - 3;
          if (room) expect(covers(view, namePoint(pose.x, pose.y)), where).toBe(false);
        }
  });

  test('flips to the side that fits at the top and bottom of the view', () => {
    expect(viewOf(said(10, 1), on(10, 2)).side).toBe('below');
    expect(viewOf(said(10, 0), on(11, 0)).side).toBe('below');
    expect(viewOf(said(10, 13), on(10, 12, 's')).side).toBe('above');
    expect(viewOf(said(10, 14), on(9, 14)).side).toBe('above');
  });

  test("never covers the reader's name, wherever they stand to read it", () => {
    for (let y = 5 * TILE; y <= 10 * TILE; y += 1)
      for (let x = 8 * TILE; x <= 13 * TILE; x += 2) {
        const pose: Pose = { x, y, dir: 'n', moving: false };
        const view = viewOf(said(10, 7), pose);
        expect(onTile(view)).toBe(true);
        expect(covers(view, namePoint(x, y)), `reader at ${x},${y}, ${view.side}`).toBe(false);
      }
  });

  test('keeps clear of other players around the trace', () => {
    const me = on(11, 7);
    const others = [on(9, 7), on(10, 5), on(10, 8)];
    const names = [me, ...others].map((p) => namePoint(p.x, p.y));
    const view = viewOf(said(10, 7), me, names);
    expect(view.side).toBe('below');
    expect(onTile(view)).toBe(true);
    for (const name of names) expect(covers(view, name)).toBe(false);
  });
});
