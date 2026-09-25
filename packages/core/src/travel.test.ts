import { describe, expect, test } from 'vitest';
import { crossingTiles } from './generate.ts';
import { createRng } from './rng.ts';
import { generateRegion, uniformScreen, withFeatures, worldOf } from './testing.ts';
import { arrivalPose } from './travel.ts';
import { canOccupy, isTileWalkable } from './walk.ts';
import { DIRS, SCREEN_H, SCREEN_PX_H, SCREEN_PX_W, TILE, inScreen, type Feature } from './world.ts';

const open = uniformScreen();
const anywhere: [number, number][] = [[10, 7]];

describe('arrivalPose', () => {
  test('arrives just inside the opposite edge at the mirrored coordinate, facing the walk', () => {
    expect(arrivalPose(open, 'e', { x: 318, y: 100 }, anywhere)).toEqual({
      x: 8,
      y: 100,
      dir: 'e',
      moving: false,
    });
    expect(arrivalPose(open, 'w', { x: 2, y: 100 }, anywhere)).toEqual({
      x: SCREEN_PX_W - 8,
      y: 100,
      dir: 'w',
      moving: false,
    });
    expect(arrivalPose(open, 's', { x: 150, y: 238 }, anywhere)).toEqual({
      x: 150,
      y: 14,
      dir: 's',
      moving: false,
    });
    expect(arrivalPose(open, 'n', { x: 150, y: 3 }, anywhere)).toEqual({
      x: 150,
      y: SCREEN_PX_H - 1,
      dir: 'n',
      moving: false,
    });
  });

  test('clamps a coordinate that was past the corner back onto the screen', () => {
    expect(arrivalPose(open, 'e', { x: 330, y: -20 }, anywhere)).toMatchObject({ x: 8, y: 4 });
    expect(arrivalPose(open, 's', { x: 400, y: 250 }, anywhere)).toMatchObject({
      x: SCREEN_PX_W - 5,
      y: 14,
    });
  });

  test('nudges along the edge to the nearest position that fits', () => {
    const blocked = withFeatures(open, [
      [0, 6, 'rock'],
      [0, 7, 'tree'],
    ]);
    const pose = arrivalPose(blocked, 'e', { x: 318, y: 118 }, anywhere);
    expect(pose).toEqual({ x: 8, y: 132, dir: 'e', moving: false });
    expect(canOccupy(blocked, 8, 131)).toBe(false);
  });

  test('prefers the closer side when nudging', () => {
    const blocked = withFeatures(open, [[0, 6, 'rock']]);
    expect(arrivalPose(blocked, 'e', { x: 318, y: 99 }, anywhere).y).toBe(95);
    expect(arrivalPose(blocked, 'e', { x: 318, y: 108 }, anywhere).y).toBe(116);
  });

  test('steps a tile inward when the whole edge is blocked', () => {
    const column: [number, number, Feature][] = Array.from({ length: SCREEN_H }, (_, ty) => [
      0,
      ty,
      'bush',
    ]);
    const pose = arrivalPose(withFeatures(open, column), 'e', { x: 318, y: 100 }, anywhere);
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
        const pose = arrivalPose(screen, dir, from, entries);
        expect(canOccupy(screen, pose.x, pose.y)).toBe(true);
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
    expect(arrivalPose(pocketed, 'e', { x: 318, y: 40 }, [[5, 0]])).toMatchObject({ x: 40, y: 40 });
    expect(arrivalPose(pocketed, 'e', { x: 318, y: 40 }, [[0, 5]])).toMatchObject({ x: 8, y: 40 });
    expect(() => arrivalPose(pocketed, 'e', { x: 318, y: 40 }, [[1, 5]])).toThrow(/no walkable/);
  });
});
