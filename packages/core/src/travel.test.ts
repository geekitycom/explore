import { describe, expect, test } from 'vitest';
import { crossingTiles } from './generate.ts';
import { bare } from './place.ts';
import { createRng } from './rng.ts';
import { generateRegion, uniformScreen, withCorners, withFeatures, worldOf } from './testing.ts';
import { arrivalPose, seamOpenings } from './travel.ts';
import { canOccupy, isTileWalkable } from './walk.ts';
import {
  DIRS,
  SCREEN_H,
  SCREEN_PX_H,
  SCREEN_PX_W,
  SCREEN_W,
  TILE,
  inScreen,
  neighborCoord,
  screenKey,
  type Feature,
} from './world.ts';

const open = uniformScreen();
const anywhere: [number, number][] = [[10, 7]];

describe('seamOpenings', () => {
  test('lists the entry-edge tiles that are walkable on both sides of the seam', () => {
    const from = withFeatures(open, [[SCREEN_W - 1, 3, 'tree']]);
    const to = withCorners(withFeatures(open, [[0, 5, 'rock']]), [
      [0, 8, 'water'],
      [1, 8, 'water'],
      [0, 9, 'water'],
    ]);
    const openings = seamOpenings(bare(from), bare(to), 'e');
    expect(openings.every(([tx]) => tx === 0)).toBe(true);
    const rows = openings.map(([, ty]) => ty);
    expect(rows).not.toContain(3);
    expect(rows).not.toContain(5);
    expect(rows).not.toContain(8);
    expect(rows).toHaveLength(SCREEN_H - 3);
    expect(seamOpenings(bare(to), bare(from), 'w').map(([, ty]) => ty)).toEqual(rows);
    expect(seamOpenings(bare(open), bare(withFeatures(open, [[4, 0, 'bush']])), 's')).toHaveLength(
      SCREEN_W - 1,
    );
    expect(seamOpenings(bare(open), bare(open), 'n').every(([, ty]) => ty === SCREEN_H - 1)).toBe(
      true,
    );
  });

  test('includes every crossing the generator opened on a seam', () => {
    const world = worldOf(9);
    const screens = generateRegion(world, { x0: -2, y0: -2, w: 4, h: 4 });
    let crossings = 0;
    for (const from of screens.values()) {
      for (const dir of DIRS) {
        const to = screens.get(screenKey(neighborCoord(from.coord, dir)));
        if (!to) continue;
        const openings = new Set(seamOpenings(bare(from), bare(to), dir).map((t) => t.join()));
        const corner = ([tx, ty]: [number, number]) =>
          (tx === 0 || tx === SCREEN_W - 1) && (ty === 0 || ty === SCREEN_H - 1);
        const edge = crossingTiles(world, to.coord).filter(
          ([tx, ty]) =>
            !corner([tx, ty]) &&
            ((dir === 'e' && tx === 0) ||
              (dir === 'w' && tx === SCREEN_W - 1) ||
              (dir === 's' && ty === 0) ||
              (dir === 'n' && ty === SCREEN_H - 1)),
        );
        for (const tile of edge) expect(openings.has(tile.join())).toBe(true);
        crossings += edge.length;
      }
    }
    expect(crossings).toBeGreaterThan(48);
  });
});

describe('arrivalPose', () => {
  test('arrives just inside the opposite edge at the mirrored coordinate, facing the walk', () => {
    expect(arrivalPose(bare(open), 'e', { x: 318, y: 100 }, anywhere)).toEqual({
      x: 8,
      y: 100,
      dir: 'e',
      moving: false,
    });
    expect(arrivalPose(bare(open), 'w', { x: 2, y: 100 }, anywhere)).toEqual({
      x: SCREEN_PX_W - 8,
      y: 100,
      dir: 'w',
      moving: false,
    });
    expect(arrivalPose(bare(open), 's', { x: 150, y: 238 }, anywhere)).toEqual({
      x: 150,
      y: 14,
      dir: 's',
      moving: false,
    });
    expect(arrivalPose(bare(open), 'n', { x: 150, y: 3 }, anywhere)).toEqual({
      x: 150,
      y: SCREEN_PX_H - 1,
      dir: 'n',
      moving: false,
    });
  });

  test('clamps a coordinate that was past the corner back onto the screen', () => {
    expect(arrivalPose(bare(open), 'e', { x: 330, y: -20 }, anywhere)).toMatchObject({
      x: 8,
      y: 4,
    });
    expect(arrivalPose(bare(open), 's', { x: 400, y: 250 }, anywhere)).toMatchObject({
      x: SCREEN_PX_W - 5,
      y: 14,
    });
  });

  test('nudges along the edge to the nearest position that fits', () => {
    const blocked = withFeatures(open, [
      [0, 6, 'rock'],
      [0, 7, 'tree'],
    ]);
    const pose = arrivalPose(bare(blocked), 'e', { x: 318, y: 118 }, anywhere);
    expect(pose).toEqual({ x: 8, y: 132, dir: 'e', moving: false });
    expect(canOccupy(bare(blocked), 8, 131)).toBe(false);
  });

  test('prefers the closer side when nudging', () => {
    const blocked = withFeatures(open, [[0, 6, 'rock']]);
    expect(arrivalPose(bare(blocked), 'e', { x: 318, y: 99 }, anywhere).y).toBe(95);
    expect(arrivalPose(bare(blocked), 'e', { x: 318, y: 108 }, anywhere).y).toBe(116);
  });

  test('steps a tile inward when the whole edge is blocked', () => {
    const column: [number, number, Feature][] = Array.from({ length: SCREEN_H }, (_, ty) => [
      0,
      ty,
      'bush',
    ]);
    const pose = arrivalPose(bare(withFeatures(open, column)), 'e', { x: 318, y: 100 }, anywhere);
    expect(pose).toEqual({ x: 24, y: 100, dir: 'e', moving: false });
  });

  test('always lands where the feet fit, on a tile that leads on from a crossing', () => {
    const world = worldOf(7);
    const screens = generateRegion(world, { x0: -3, y0: -3, w: 7, h: 6 });
    const rng = createRng(11);
    let checked = 0;
    for (const screen of screens.values()) {
      const entries = crossingTiles(world, screen.coord);
      const reachable = new Set<string>();
      const stack = entries.filter(([tx, ty]) => isTileWalkable(screen, tx, ty));
      for (const [tx, ty] of stack) reachable.add(`${tx},${ty}`);
      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const) {
          if (!inScreen(nx, ny) || reachable.has(`${nx},${ny}`)) continue;
          if (!isTileWalkable(screen, nx, ny)) continue;
          reachable.add(`${nx},${ny}`);
          stack.push([nx, ny]);
        }
      }
      for (const dir of DIRS) {
        const from = { x: rng() * SCREEN_PX_W, y: rng() * SCREEN_PX_H };
        const pose = arrivalPose(bare(screen), dir, from, entries);
        expect(canOccupy(bare(screen), pose.x, pose.y)).toBe(true);
        expect(reachable.has(`${Math.floor(pose.x / TILE)},${Math.floor(pose.y / TILE)}`)).toBe(
          true,
        );
        checked++;
      }
    }
    expect(checked).toBe(168);
  });

  test('skips a walkable pocket that no crossing leads to', () => {
    const wall: [number, number, Feature][] = Array.from({ length: SCREEN_H }, (_, ty) => [
      1,
      ty,
      'tree',
    ]);
    const pocketed = withFeatures(uniformScreen(), wall);
    expect(arrivalPose(bare(pocketed), 'e', { x: 318, y: 40 }, [[5, 0]])).toMatchObject({
      x: 40,
      y: 40,
    });
    expect(arrivalPose(bare(pocketed), 'e', { x: 318, y: 40 }, [[0, 5]])).toMatchObject({
      x: 8,
      y: 40,
    });
    expect(() => arrivalPose(bare(pocketed), 'e', { x: 318, y: 40 }, [[1, 5]])).toThrow(
      /no walkable/,
    );
  });
});
