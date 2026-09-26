import { describe, expect, test } from 'vitest';
import { generateScreen, networkOf } from './generate.ts';
import { LANDMARK_NOUNS, inArea, landmarkOn, signpostSpot, type Landmark } from './landmarks.ts';
import { bare, placeOf, type Place, type Tile } from './place.ts';
import { POI_KINDS, REGION_H, REGION_W, type Poi, type PoiKind } from './poi.ts';
import { uniformScreen, withCorners, withFeatures, worldOf } from './testing.ts';
import { isWalkable } from './walk.ts';
import {
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  tileCorners,
  type Screen,
  type ScreenCoord,
  type World,
} from './world.ts';

const KINDS = Object.keys(LANDMARK_NOUNS) as Landmark['poi'][];
const SAMPLES = 3;

type Found = { world: World; poi: Poi; coord: ScreenCoord; screen: Screen };

/** A few landmarks of every kind, searching seeds in turn. */
function samples(): Map<PoiKind, Found[]> {
  const found = new Map<PoiKind, Found[]>(KINDS.map((k) => [k, []]));
  const box = { x0: -4 * REGION_W, y0: -4 * REGION_H, x1: 4 * REGION_W, y1: 4 * REGION_H };
  const full = () => [...found.values()].every((list) => list.length >= SAMPLES);
  for (let seed = 1; seed < 40 && !full(); seed++) {
    const world = worldOf(seed);
    for (const poi of networkOf(world, OVERWORLD).poisIn(box)) {
      const list = found.get(poi.kind);
      if (!list || list.length >= SAMPLES) continue;
      const coord = {
        layer: OVERWORLD,
        sx: Math.floor(poi.x / SCREEN_W),
        sy: Math.floor(poi.y / SCREEN_H),
      };
      list.push({ world, poi, coord, screen: generateScreen(world, coord) });
    }
  }
  return found;
}

/** How many separate patches of walkable ground the screen has. */
function patches(place: Place): number {
  const seen = new Set<string>();
  let count = 0;
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      if (!isWalkable(place, tx, ty) || seen.has(`${tx},${ty}`)) continue;
      count++;
      const stack: Tile[] = [{ tx, ty }];
      seen.add(`${tx},${ty}`);
      while (stack.length > 0) {
        const at = stack.pop()!;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const n = { tx: at.tx + dx, ty: at.ty + dy };
          if (!isWalkable(place, n.tx, n.ty) || seen.has(`${n.tx},${n.ty}`)) continue;
          seen.add(`${n.tx},${n.ty}`);
          stack.push(n);
        }
      }
    }
  }
  return count;
}

describe('landmarks', () => {
  const found = samples();

  test.each(KINDS)('a %s belongs to the screen holding its centre and no other', (kind) => {
    for (const { world, poi, coord } of found.get(kind)!) {
      expect(landmarkOn(world, coord)).toEqual({
        poi: kind,
        area: {
          x: poi.x - coord.sx * SCREEN_W,
          y: poi.y - coord.sy * SCREEN_H,
          rx: POI_KINDS[kind].reach[0],
          ry: POI_KINDS[kind].reach[1],
        },
      });
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const next = { ...coord, sx: coord.sx + dx, sy: coord.sy + dy };
        expect(landmarkOn(world, next)?.area.x).not.toBe(poi.x - next.sx * SCREEN_W);
      }
    }
  });

  test.each(KINDS)(
    "a %s's signpost stands in it, off the road, and splits no ground if solid",
    (kind) => {
      for (const { world, coord, screen } of found.get(kind)!) {
        const { area } = landmarkOn(world, coord)!;
        const spot = signpostSpot(screen, area);
        expect(spot, `${kind} on seed ${world.seed} at ${coord.sx},${coord.sy}`).toBeDefined();
        const { tx, ty } = spot!;
        expect(inArea(area, spot!)).toBe(true);
        expect(tileCorners(screen, tx, ty)).not.toContain('path');
        const stands = [
          { tx: tx + 1, ty },
          { tx: tx - 1, ty },
          { tx, ty: ty + 1 },
          { tx, ty: ty - 1 },
        ].filter((t) => isWalkable(bare(screen), t.tx, t.ty) && inArea(area, t));
        expect(stands).not.toEqual([]);

        const signed = placeOf(screen, [
          { kind: 'landmark', tx, ty, poi: kind, area, named: NAMED },
        ]);
        expect(isWalkable(signed, tx, ty)).toBe(false);
        expect(patches(signed)).toBe(patches(bare(screen)));
        expect(signpostSpot(screen, area)).toEqual(spot);
      }
    },
  );

  test('a signpost never stands on a road, even where the road is all the open ground', () => {
    const area = { x: 10.5, y: 7.5, rx: 3, ry: 3 };
    const road = uniformScreen('path');
    expect(signpostSpot(road, area)).toBeUndefined();
    const verge = withCorners(
      road,
      [9, 10, 11, 12].flatMap((x) =>
        [6, 7, 8, 9].map((y): [number, number, 'grass'] => [x, y, 'grass']),
      ),
    );
    expect(signpostSpot(verge, area)).toEqual({ tx: 10, ty: 7 });
  });

  test('a signpost never stands in a corridor it would cut in two', () => {
    const area = { x: 10.5, y: 7.5, rx: 6, ry: 4 };
    const walls = uniformScreen('grass', 'rock');
    const corridor = withFeatures(
      walls,
      Array.from({ length: SCREEN_W }, (_, tx): [number, number, 'none'] => [tx, 7, 'none']),
    );
    expect(signpostSpot(corridor, area)).toBeUndefined();
    const nook = withFeatures(corridor, [[10, 6, 'none']]);
    expect(signpostSpot(nook, area)).toEqual({ tx: 10, ty: 6 });
  });
});

const NAMED = { name: 'Here', by: { id: 1, name: 'ann' }, at: 0 };
