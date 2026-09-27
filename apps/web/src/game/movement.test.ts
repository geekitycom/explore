import {
  WALK_SPEED,
  bare,
  canOccupy,
  canWalk,
  createRng,
  secretGarden,
  type Dir,
  type Pose,
} from '@explore/core';
import { uniformScreen, withFeatures } from '@explore/core/testing';
import { describe, expect, test } from 'vitest';
import { steer, step } from './movement.ts';

const at = (x: number, y: number, dir: Dir = 's'): Pose => ({ x, y, dir, moving: false });
const held = (...dirs: Dir[]) => new Set(dirs);
const KEY_SETS: readonly Dir[][] = [
  ['n'],
  ['s'],
  ['e'],
  ['w'],
  ['n', 'e'],
  ['n', 'w'],
  ['s', 'e'],
  ['s', 'w'],
];

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

  test('reports the edge crossed, with the feet still touching the screen', () => {
    for (const [from, dir] of [
      [at(2, 100), 'w'],
      [at(318, 100), 'e'],
      [at(100, 2), 'n'],
      [at(100, 238), 's'],
    ] as const) {
      const { pose, exit } = step(open, from, held(dir), 0.1);
      expect(exit).toBe(dir);
      expect(canOccupy(open, pose.x, pose.y)).toBe(true);
    }
  });

  test('every frame is a walk the server accepts, whatever the frame rate and keys', () => {
    const rocks: [number, number, 'rock'][] = [];
    for (let ty = 1; ty < 15; ty += 3)
      for (let tx = 1; tx < 20; tx += 3) rocks.push([tx, ty, 'rock']);
    const place = bare(withFeatures(uniformScreen(), rocks));
    const start = at(136, 104);
    expect(canOccupy(place, start.x, start.y)).toBe(true);
    const random = createRng(1);
    const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;
    let pose = start;
    let keys = held('e');
    for (let frame = 0; frame < 50_000; frame++) {
      if (random() < 0.05) keys = held(...pick(KEY_SETS));
      const { pose: next, exit } = step(place, pose, keys, 0.001 + random() * 0.099);
      expect(canWalk(place, pose, next)).toBe(true);
      pose = exit ? start : next;
    }
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
