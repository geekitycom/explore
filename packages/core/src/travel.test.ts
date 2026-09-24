import { describe, expect, test } from 'vitest';
import { createRng } from './rng.ts';
import { growWorld, uniformScreen, withFeatures } from './testing.ts';
import { arrivalPose } from './travel.ts';
import { canOccupy } from './walk.ts';
import { DIRS, SCREEN_H, SCREEN_PX_H, SCREEN_PX_W, type Feature } from './world.ts';

const open = uniformScreen();

describe('arrivalPose', () => {
  test('arrives just inside the opposite edge at the mirrored coordinate, facing the walk', () => {
    expect(arrivalPose(open, 'e', { x: 318, y: 100 })).toEqual({
      x: 5,
      y: 100,
      dir: 'e',
      moving: false,
    });
    expect(arrivalPose(open, 'w', { x: 2, y: 100 })).toEqual({
      x: SCREEN_PX_W - 5,
      y: 100,
      dir: 'w',
      moving: false,
    });
    expect(arrivalPose(open, 's', { x: 150, y: 238 })).toEqual({
      x: 150,
      y: 4,
      dir: 's',
      moving: false,
    });
    expect(arrivalPose(open, 'n', { x: 150, y: 3 })).toEqual({
      x: 150,
      y: SCREEN_PX_H - 1,
      dir: 'n',
      moving: false,
    });
  });

  test('clamps a coordinate that was past the corner back onto the screen', () => {
    expect(arrivalPose(open, 'e', { x: 330, y: -20 })).toMatchObject({ x: 5, y: 4 });
    expect(arrivalPose(open, 's', { x: 400, y: 250 })).toMatchObject({ x: SCREEN_PX_W - 5, y: 4 });
  });

  test('nudges along the edge to the nearest position that fits', () => {
    const blocked = withFeatures(open, [
      [0, 6, 'rock'],
      [0, 7, 'tree'],
    ]);
    const pose = arrivalPose(blocked, 'e', { x: 318, y: 118 });
    expect(pose).toEqual({ x: 5, y: 132, dir: 'e', moving: false });
    expect(canOccupy(blocked, 5, 131)).toBe(false);
  });

  test('prefers the closer side when nudging', () => {
    const blocked = withFeatures(open, [[0, 6, 'rock']]);
    expect(arrivalPose(blocked, 'e', { x: 318, y: 99 }).y).toBe(95);
    expect(arrivalPose(blocked, 'e', { x: 318, y: 108 }).y).toBe(116);
  });

  test('steps a tile inward when the whole edge is blocked', () => {
    const column: [number, number, Feature][] = Array.from({ length: SCREEN_H }, (_, ty) => [
      0,
      ty,
      'bush',
    ]);
    const pose = arrivalPose(withFeatures(open, column), 'e', { x: 318, y: 100 });
    expect(pose).toEqual({ x: 21, y: 100, dir: 'e', moving: false });
  });

  test('always lands where the feet fit on generated screens', () => {
    const { world } = growWorld(7, 40);
    const rng = createRng(11);
    let checked = 0;
    for (const screen of world.values()) {
      for (const dir of DIRS) {
        const from = { x: rng() * SCREEN_PX_W, y: rng() * SCREEN_PX_H };
        const pose = arrivalPose(screen, dir, from);
        expect(canOccupy(screen, pose.x, pose.y)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBe(164);
  });
});
