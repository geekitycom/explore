import { WALK_SPEED, bare, secretGarden, type Dir, type Pose } from '@explore/core';
import { uniformScreen, withFeatures } from '@explore/core/testing';
import { describe, expect, test } from 'vitest';
import { step } from './movement.ts';

const at = (x: number, y: number, dir: Dir = 's'): Pose => ({ x, y, dir, moving: false });
const held = (...dirs: Dir[]) => new Set(dirs);

describe('step', () => {
  const open = bare(uniformScreen());

  test('walks at WALK_SPEED and faces the direction of travel', () => {
    const { pose, exit } = step(open, at(100, 100), held('e'), 0.5);
    expect(pose).toEqual({ x: 100 + WALK_SPEED / 2, y: 100, dir: 'e', moving: true });
    expect(exit).toBeUndefined();
  });

  test('diagonal speed is normalized', () => {
    const { pose } = step(open, at(100, 100), held('e', 's'), 1);
    expect(Math.hypot(pose.x - 100, pose.y - 100)).toBeCloseTo(WALK_SPEED);
  });

  test('stops at a blocking tile but slides along it', () => {
    const rockRight = bare(withFeatures(uniformScreen(), [[7, 6, 'rock']]));
    const { pose } = step(rockRight, at(7 * 16 - 6, 6 * 16 + 8), held('e', 's'), 0.1);
    expect(pose.x).toBe(7 * 16 - 6);
    expect(pose.y).toBeGreaterThan(6 * 16 + 8);
  });

  test('reports the edge crossed', () => {
    expect(step(open, at(2, 100), held('w'), 0.1).exit).toBe('w');
    expect(step(open, at(318, 100), held('e'), 0.1).exit).toBe('e');
    expect(step(open, at(100, 2), held('n'), 0.1).exit).toBe('n');
    expect(step(open, at(100, 238), held('s'), 0.1).exit).toBe('s');
  });

  test('no keys means standing still', () => {
    expect(step(open, { ...at(50, 50), moving: true }, held(), 0.1)).toEqual({
      pose: at(50, 50),
      exit: undefined,
    });
  });

  test('cannot walk into the garden pond', () => {
    const garden = bare(secretGarden());
    let pose = at(10 * 16, 11 * 16 + 8, 'n');
    for (let i = 0; i < 60; i++) pose = step(garden, pose, held('n'), 1 / 30).pose;
    expect(pose.y).toBeGreaterThan(9 * 16);
  });
});
