import { WALK_SPEED, bare, secretGarden, type Dir, type Pose } from '@explore/core';
import { uniformScreen, withFeatures } from '@explore/core/testing';
import { describe, expect, test } from 'vitest';
import { steer, step } from './movement.ts';

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

describe('steer', () => {
  /** The feet box's centre sits 1.5px above the pose, so this avatar's centre is (160, 120). */
  const centred = at(160, 121.5);
  const toward = (degrees: number, distance = 50) => {
    const r = (degrees * Math.PI) / 180;
    return { x: 160 + distance * Math.cos(r), y: 120 + distance * Math.sin(r) };
  };
  const dirs = (pose: Pose, target: { x: number; y: number }) => [...steer(pose, target).held];

  test('snaps to 8 directions of 45 degrees each, clockwise from east', () => {
    const sectors: [number, Dir[], Dir][] = [
      [0, ['e'], 'e'],
      [45, ['e', 's'], 'e'],
      [90, ['s'], 's'],
      [135, ['s', 'w'], 'w'],
      [180, ['w'], 'w'],
      [225, ['w', 'n'], 'w'],
      [270, ['n'], 'n'],
      [315, ['n', 'e'], 'e'],
    ];
    for (const [degrees, held, facing] of sectors) {
      for (const offset of [-22, 0, 22]) {
        expect(dirs(centred, toward(degrees + offset)).sort()).toEqual([...held].sort());
      }
      expect(steer(centred, toward(degrees)).held.has(facing)).toBe(true);
    }
  });

  test('faces the axis the pointer is furthest along', () => {
    expect(steer(centred, toward(30)).facing).toBe('e');
    expect(steer(centred, toward(60)).facing).toBe('s');
    expect(steer(centred, toward(240)).facing).toBe('n');
  });

  test('stops within half a tile of the pointer', () => {
    expect(steer(centred, toward(0, 7))).toEqual({ held: new Set(), facing: undefined });
    expect(steer(centred, toward(135, 7)).held.size).toBe(0);
    expect(dirs(centred, toward(0, 9))).toEqual(['e']);
  });

  test('a pointer in the outermost tile band walks on past that edge', () => {
    expect(dirs(at(6, 121.5), { x: 2, y: 120 })).toEqual(['w']);
    expect(dirs(at(316, 121.5), { x: 318, y: 120 })).toEqual(['e']);
    expect(dirs(at(160, 7.5), { x: 160, y: 2 })).toEqual(['n']);
    expect(dirs(at(160, 237.5), { x: 160, y: 238 })).toEqual(['s']);
  });

  test('a pointer dragged past the screen keeps steering', () => {
    expect(dirs(centred, { x: -40, y: 120 })).toEqual(['w']);
    expect(dirs(centred, { x: 160, y: 400 })).toEqual(['s']);
  });
});
