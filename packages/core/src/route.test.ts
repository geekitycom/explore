import { describe, expect, test } from 'vitest';
import { bare, type Place } from './place.ts';
import type { Point } from './roads.ts';
import { findRoute } from './route.ts';
import { createRng } from './rng.ts';
import { uniformScreen, withFeatures } from './testing.ts';
import { canOccupy, canWalk } from './walk.ts';
import { SCREEN_H, SCREEN_W, TILE } from './world.ts';

/** The feet position that centres the feet box on a tile. */
const centre = (tx: number, ty: number): Point => ({ x: tx * TILE + 8, y: ty * TILE + 9.5 });

const rocks = (tiles: [number, number][]): Place =>
  bare(
    withFeatures(
      uniformScreen(),
      tiles.map(([tx, ty]) => [tx, ty, 'rock'] as const),
    ),
  );

/** Every pose a walker passes along `route` at quarter-pixel steps, from `from`. */
function poses(from: Point, route: readonly Point[]): Point[] {
  const out = [from];
  let a = from;
  for (const b of route) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 4));
    for (let i = 1; i <= n; i++)
      out.push({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n });
    a = b;
  }
  return out;
}

/** Each pose passes canOccupy, and each step between them is a move the server accepts. */
function expectWalkable(place: Place, from: Point, route: readonly Point[]) {
  const all = poses(from, route);
  for (const [i, p] of all.entries()) {
    expect(canOccupy(place, p.x, p.y), `pose ${p.x},${p.y}`).toBe(true);
    if (i > 0) expect(canWalk(place, all[i - 1]!, p), `step to ${p.x},${p.y}`).toBe(true);
  }
}

describe('findRoute', () => {
  test('an open field is one straight line to the exact point', () => {
    const place = rocks([]);
    const from = centre(2, 2);
    const to = { x: 250.3, y: 181.7 };
    expect(findRoute(place, from, to)).toEqual([to]);
  });

  test('walks around a U-shape into its mouth from outside', () => {
    const u: [number, number][] = [];
    for (let ty = 5; ty <= 9; ty++) u.push([8, ty], [12, ty]);
    for (let tx = 9; tx <= 11; tx++) u.push([tx, 9]);
    const place = rocks(u);
    const from = centre(10, 12);
    const to = centre(10, 7);

    const route = findRoute(place, from, to);

    expect(route.at(-1)).toEqual(to);
    expect(Math.min(...route.map((p) => p.y))).toBeLessThan(5 * TILE);
    expectWalkable(place, from, route);
  });

  test('a blocked target ends on the reachable tile nearest it', () => {
    const place = rocks([[10, 7]]);
    const from = centre(10, 12);
    const route = findRoute(place, from, centre(10, 7));
    expect(route.at(-1)).toEqual(centre(10, 8));
    expectWalkable(place, from, route);
  });

  test('an enclosed target ends beside the enclosure, nearest the target', () => {
    const ring: [number, number][] = [];
    for (let tx = 8; tx <= 12; tx++) ring.push([tx, 5], [tx, 9]);
    for (let ty = 6; ty <= 8; ty++) ring.push([8, ty], [12, ty]);
    const place = rocks(ring);
    const from = centre(2, 7);
    const route = findRoute(place, from, { x: 11 * TILE + 8, y: 7 * TILE + 9.5 });
    expect(route.at(-1)).toEqual(centre(13, 7));
    expectWalkable(place, from, route);
  });

  test('never cuts the corner between two blocked tiles', () => {
    const place = rocks([
      [10, 7],
      [11, 8],
    ]);
    const from = centre(10, 8);
    const to = centre(11, 7);

    const route = findRoute(place, from, to);

    expect(route.at(-1)).toEqual(to);
    expect(route.length).toBeGreaterThan(1);
    expectWalkable(place, from, route);
  });

  test('an L-shaped corridor is two straight lines with one turn', () => {
    const open = new Set<string>();
    for (let tx = 2; tx <= 15; tx++) open.add(`${tx},3`);
    for (let ty = 3; ty <= 12; ty++) open.add(`15,${ty}`);
    const walls: [number, number][] = [];
    for (let ty = 0; ty < SCREEN_H; ty++)
      for (let tx = 0; tx < SCREEN_W; tx++) if (!open.has(`${tx},${ty}`)) walls.push([tx, ty]);
    const place = rocks(walls);
    const from = centre(2, 3);
    const to = centre(15, 12);

    const route = findRoute(place, from, to);

    expect(route).toEqual([centre(15, 3), to]);
    expectWalkable(place, from, route);
  });

  test('every pose along any route passes canOccupy, over random rock fields', () => {
    const random = createRng(7);
    const tile = (n: number) => Math.floor(random() * n);
    for (let run = 0; run < 100; run++) {
      const field: [number, number][] = [];
      for (let i = 0; i < 80; i++) field.push([tile(SCREEN_W), tile(SCREEN_H)]);
      const place = rocks(field);
      const from = { x: 8 + random() * 304, y: 8 + random() * 224 };
      if (!canOccupy(place, from.x, from.y)) continue;
      const to = { x: random() * 320, y: 1.5 + random() * 240 };
      expectWalkable(place, from, findRoute(place, from, to));
    }
  });

  test('a target past an edge walks off that edge', () => {
    const place = rocks([]);
    const route = findRoute(place, centre(5, 7), { x: -29, y: 100 });
    expect(route.at(-2)).toEqual(centre(0, 6));
    expect(route.at(-1)).toEqual({ x: -TILE, y: centre(0, 6).y });
  });

  test('a target past a walled-off edge stops at the nearest reachable tile', () => {
    const wall: [number, number][] = [];
    for (let ty = 0; ty < SCREEN_H; ty++) wall.push([0, ty]);
    const place = rocks(wall);
    const route = findRoute(place, centre(5, 7), { x: -29, y: 100 });
    expect(route.at(-1)).toEqual(centre(1, 6));
  });
});
