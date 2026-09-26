import {
  GARDEN_SPAWN,
  SCREEN_H,
  SCREEN_W,
  TILE,
  boxTiles,
  canOccupy,
  isWalkable,
  placeOf,
  secretGarden,
  type Pose,
  type Tile,
} from '@explore/core';
import { expect, test } from 'vitest';
import { departurePortal, occupied, visitorArrival } from './arrival.ts';

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
const tileKey = ({ tx, ty }: Tile) => `${tx},${ty}`;
const tileUnder = ({ x, y }: Pose): Tile => ({
  tx: Math.floor(x / TILE),
  ty: Math.floor(y / TILE),
});

/** Up to 40 players standing wherever the garden lets them, the spawn always among them. */
function crowd(random: () => number): Pose[] {
  const present: Pose[] = [{ ...GARDEN_SPAWN, moving: false }];
  const size = 1 + Math.floor(random() * 40);
  while (present.length < size) {
    const candidate: Pose = {
      x: Math.floor(random() * SCREEN_W * TILE),
      y: Math.floor(random() * SCREEN_H * TILE),
      dir: 'n',
      moving: false,
    };
    if (canOccupy(garden, candidate.x, candidate.y)) present.push(candidate);
  }
  return present;
}

test('a visitor stands in front of their portal, both on walkable garden tiles nobody stands on', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const random = lcg(seed);
    const present = crowd(random);
    const taken = new Set(present.flatMap(tileKeys));

    const { pose, portal } = visitorArrival(garden, occupied(present), random);
    const at = `seed ${seed}: ${JSON.stringify({ pose, portal })}`;
    expect(canOccupy(garden, pose.x, pose.y), at).toBe(true);
    expect(isWalkable(garden, portal.tx, portal.ty), at).toBe(true);
    expect(
      tileKeys(pose).filter((k) => taken.has(k)),
      at,
    ).toEqual([]);
    expect(taken.has(tileKey(portal)), at).toBe(false);
    expect(portal, at).toEqual({ tx: tileUnder(pose).tx, ty: tileUnder(pose).ty - 1 });
    expect(pose.moving).toBe(false);
  }
});

test("a leaving player's portal opens on a free walkable tile right beside them", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const random = lcg(seed);
    const [leaver, ...rest] = crowd(random).reverse();
    const taken = new Set(rest.flatMap(tileKeys));

    const portal = departurePortal(garden, leaver!, occupied(rest));
    const here = tileUnder(leaver!);
    const at = `seed ${seed}: ${JSON.stringify({ leaver, portal })}`;
    expect(Math.abs(portal.tx - here.tx) + Math.abs(portal.ty - here.ty), at).toBeLessThanOrEqual(
      1,
    );
    if (portal.tx === here.tx && portal.ty === here.ty) continue;
    expect(isWalkable(garden, portal.tx, portal.ty), at).toBe(true);
    expect(taken.has(tileKey(portal)), at).toBe(false);
  }
});

test('a portal opens north of a player standing in the open, so they walk away into it', () => {
  const pose: Pose = { ...GARDEN_SPAWN, moving: false };
  expect(departurePortal(garden, pose, new Set())).toEqual({
    tx: tileUnder(pose).tx,
    ty: tileUnder(pose).ty - 1,
  });
});

test('an empty garden gives the visitor a spread of tiles across the whole screen', () => {
  const seen = new Set<string>();
  const rows = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const { x, y } = visitorArrival(garden, new Set(), () => i / 200).pose;
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
  expect(visitorArrival(garden, occupied(everyone), () => 0.5).pose).toEqual({
    ...GARDEN_SPAWN,
    moving: false,
  });
});
