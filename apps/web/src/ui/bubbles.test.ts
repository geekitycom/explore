import { SCREEN_PX_H, TILE, type Pose, type Said } from '@explore/core';
import { describe, expect, test } from 'vitest';
import { bubbleViews, namePoint, type NamePoint } from './bubbles.ts';

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

  test('keeps its body on screen near an edge', () => {
    const anchor = (tx: number) => bubbleViews([said(tx)], reader(on(tx, 6)))[0]!.anchor;
    expect([anchor(0), anchor(10), anchor(19)]).toEqual(['start', 'middle', 'end']);
  });

  const baseOf = (names: NamePoint[], pose: Pose, trace = said(10, 7)) =>
    Math.round((1 - bubbleViews([trace], reader(pose, 2, names))[0]!.bottom / 100) * SCREEN_PX_H);
  /** A name covers the world rows from ten pixels above its point down to it. */
  const apart = (name: NamePoint, base: number) => name.y <= base - 40 || name.y - 10 >= base;

  test("never covers the reader's name, wherever they stand to read it", () => {
    for (let y = 5 * TILE; y <= 10 * TILE; y += 1)
      for (let x = 8 * TILE; x <= 13 * TILE; x += 2) {
        const pose: Pose = { x, y, dir: 'n', moving: false };
        const name = namePoint(x, y);
        const base = baseOf([name], pose);
        expect(base).toBeLessThanOrEqual(7 * TILE);
        expect(apart(name, base), `reader at ${x},${y}, bubble base ${base}`).toBe(true);
      }
  });

  test('rises clear of other players beside the trace, and no higher than it must', () => {
    const reader = on(11, 7);
    const others = [on(9, 7), on(10, 5), on(10, 8)];
    const names = [reader, ...others].map((p) => namePoint(p.x, p.y));
    const base = baseOf(names, reader);
    for (const name of names) expect(apart(name, base)).toBe(true);
    expect(base).toBe(namePoint(0, on(10, 5).y).y - 14);
    const south = on(10, 8);
    expect(baseOf([namePoint(south.x, south.y)], south)).toBe(7 * TILE - 4);
  });
});
