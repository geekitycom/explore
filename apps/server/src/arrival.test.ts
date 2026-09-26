import {
  GARDEN_SPAWN,
  SCREEN_H,
  SCREEN_W,
  TILE,
  boxTiles,
  canOccupy,
  placeOf,
  secretGarden,
  type Pose,
} from '@explore/core';
import { expect, test } from 'vitest';
import { visitorPose } from './arrival.ts';

const garden = placeOf(secretGarden(), []);

/** A small deterministic generator, so a failing seed can be replayed. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const tileKeys = (pose: Pose) => boxTiles(pose.x, pose.y).map(({ tx, ty }) => `${tx},${ty}`);

test('a visitor lands on a walkable garden tile whose feet touch no tile anyone stands on', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const random = lcg(seed);
    const present: Pose[] = [{ ...GARDEN_SPAWN, moving: false }];
    const crowd = 1 + Math.floor(random() * 40);
    while (present.length < crowd) {
      const candidate: Pose = {
        x: Math.floor(random() * SCREEN_W * TILE),
        y: Math.floor(random() * SCREEN_H * TILE),
        dir: 'n',
        moving: false,
      };
      if (canOccupy(garden, candidate.x, candidate.y)) present.push(candidate);
    }
    const taken = new Set(present.flatMap(tileKeys));

    const pose = visitorPose(garden, present, random);
    expect(canOccupy(garden, pose.x, pose.y), `seed ${seed}`).toBe(true);
    expect(
      tileKeys(pose).filter((k) => taken.has(k)),
      `seed ${seed}: ${JSON.stringify(pose)}`,
    ).toEqual([]);
    expect(pose.moving).toBe(false);
  }
});

test('an empty garden gives the visitor a spread of tiles across the whole screen', () => {
  const seen = new Set<string>();
  const rows = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const { x, y } = visitorPose(garden, [], () => i / 200);
    seen.add(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`);
    rows.add(Math.floor(y / TILE));
  }
  expect(seen.size).toBeGreaterThan(150);
  expect(rows.size).toBeGreaterThan(10);
});

test('with the whole screen taken the spawn is the fallback rather than nowhere', () => {
  const everyone: Pose[] = [];
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      everyone.push({ x: (tx + 0.5) * TILE, y: ty * TILE + 10, dir: 'n', moving: false });
    }
  }
  expect(visitorPose(garden, everyone, () => 0.5)).toEqual({ ...GARDEN_SPAWN, moving: false });
});
