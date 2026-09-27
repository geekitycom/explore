import {
  SCREEN_PX_H,
  SCREEN_PX_W,
  WALK_SPEED,
  bare,
  canOccupy,
  canWalk,
  createRng,
  findRoute,
  secretGarden,
  type Dir,
  type Point,
  type Pose,
} from '@explore/core';
import { uniformScreen, withFeatures } from '@explore/core/testing';
import { describe, expect, test } from 'vitest';
import { follow, goalFor, step } from './movement.ts';

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

describe('goalFor', () => {
  test('aims the feet so the feet box centres on the pointer', () => {
    expect(goalFor({ x: 160, y: 120 })).toEqual({ x: 160, y: 121.5 });
  });

  test('a pointer in the outermost tile band aims past that edge', () => {
    expect(goalFor({ x: 2, y: 120 }).x).toBeLessThan(0);
    expect(goalFor({ x: 318, y: 120 }).x).toBeGreaterThan(SCREEN_PX_W);
    expect(goalFor({ x: 160, y: 2 }).y).toBeLessThan(0);
    expect(goalFor({ x: 160, y: 238 }).y).toBeGreaterThan(SCREEN_PX_H);
  });
});

describe('follow', () => {
  const open = bare(uniformScreen());

  test('walks straight at the waypoint at WALK_SPEED, facing its main axis', () => {
    const { pose, route } = follow(open, at(100, 100), [{ x: 200, y: 150 }], 0.5);
    const along = Math.hypot(pose.x - 100, pose.y - 100);
    expect(along).toBeCloseTo(WALK_SPEED / 2);
    expect((pose.y - 100) / (pose.x - 100)).toBeCloseTo(0.5);
    expect(pose).toMatchObject({ dir: 'e', moving: true });
    expect(route).toEqual([{ x: 200, y: 150 }]);
  });

  test('a frame ends on a waypoint it reaches instead of turning past it', () => {
    const { pose, route } = follow(
      open,
      at(100, 100),
      [
        { x: 102, y: 100 },
        { x: 102, y: 200 },
      ],
      1,
    );
    expect(pose).toMatchObject({ x: 102, y: 100 });
    expect(route).toEqual([{ x: 102, y: 200 }]);
  });

  test('a step into a wall slides along it', () => {
    const rockRight = bare(withFeatures(uniformScreen(), [[7, 6, 'rock']]));
    const start = at(7 * 16 - 6, 6 * 16 + 8);
    const { pose } = follow(rockRight, start, [{ x: 7 * 16 + 20, y: 6 * 16 + 20 }], 0.1);
    expect(pose.x).toBe(start.x);
    expect(pose.y).toBeGreaterThan(start.y);
  });

  test('stands still once the route is done', () => {
    const { pose, route } = follow(open, { ...at(50, 50), moving: true }, [{ x: 50, y: 50 }], 0.1);
    expect(pose.moving).toBe(false);
    expect(route).toEqual([]);
  });

  test('walks off the edge a pointer in the outer band points past', () => {
    let pose = at(40, 121.5);
    let route: readonly Point[] = findRoute(open, pose, goalFor({ x: 3, y: 120 }));
    let exit: Dir | undefined;
    for (let frame = 0; frame < 200 && !exit; frame++)
      ({ pose, route, exit } = follow(open, pose, route, 1 / 60));
    expect(exit).toBe('w');
  });

  test('every frame of a routed walk is a move the server accepts, and it arrives', () => {
    const random = createRng(3);
    const tile = (n: number) => Math.floor(random() * n);
    for (let run = 0; run < 40; run++) {
      const field: [number, number, 'rock'][] = [];
      for (let i = 0; i < 70; i++) field.push([tile(20), tile(15), 'rock']);
      const place = bare(withFeatures(uniformScreen(), field));
      let pose = at(24 + random() * 272, 24 + random() * 192);
      if (!canOccupy(place, pose.x, pose.y)) continue;
      const goal = { x: 24 + random() * 272, y: 24 + random() * 192 };
      let route: readonly Point[] = findRoute(place, pose, goal);
      const end = route.at(-1)!;
      for (let frame = 0; frame < 5000 && route.length > 0; frame++) {
        const dt = 0.001 + random() * 0.099;
        const next = follow(place, pose, route, dt);
        expect(canWalk(place, pose, next.pose)).toBe(true);
        expect(Math.hypot(next.pose.x - pose.x, next.pose.y - pose.y)).toBeLessThanOrEqual(
          WALK_SPEED * dt + 1e-9,
        );
        ({ pose, route } = next);
      }
      expect(pose).toMatchObject({ x: end.x, y: end.y });
    }
  });
});
