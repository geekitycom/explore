import { describe, expect, test } from 'vitest';
import { generateScreen, landFor, networkOf } from './generate.ts';
import { POI_KINDS, REGION_H, REGION_W, landmarkAt, type Poi, type PoiKind } from './poi.ts';
import { worldOf } from './testing.ts';
import {
  BLOCKING_FEATURES,
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  featureAt,
  screenKey,
  type Feature,
  type Screen,
  type World,
} from './world.ts';

function tiles(world: World) {
  const screens = new Map<string, Screen>();
  return (gtx: number, gty: number): Feature => {
    const coord = {
      layer: OVERWORLD,
      sx: Math.floor(gtx / SCREEN_W),
      sy: Math.floor(gty / SCREEN_H),
    };
    let screen = screens.get(screenKey(coord));
    if (!screen) screens.set(screenKey(coord), (screen = generateScreen(world, coord)));
    return featureAt(screen, gtx - coord.sx * SCREEN_W, gty - coord.sy * SCREEN_H);
  };
}

/** Screens on a sparse grid around the garden, so a test sees many biomes quickly. */
function sampled(world: World): Screen[] {
  const screens: Screen[] = [];
  for (let sy = -45; sy <= 45; sy += 5) {
    for (let sx = -45; sx <= 45; sx += 5) {
      screens.push(generateScreen(world, { layer: OVERWORLD, sx, sy }));
    }
  }
  return screens;
}

const KINDS = (Object.keys(POI_KINDS) as PoiKind[]).filter((k) => k !== 'hub');

/** The nearest point of each kind, searching seeds in turn until every kind turns up. */
function onePerKind(): Map<PoiKind, { world: World; poi: Poi }> {
  const found = new Map<PoiKind, { world: World; poi: Poi }>();
  const box = { x0: -5 * REGION_W, y0: -5 * REGION_H, x1: 5 * REGION_W, y1: 5 * REGION_H };
  for (let seed = 1; seed < 20 && found.size < KINDS.length; seed++) {
    const world = worldOf(seed);
    for (const poi of networkOf(world, OVERWORLD).poisIn(box)) {
      if (poi.kind !== 'hub' && !found.has(poi.kind)) found.set(poi.kind, { world, poi });
    }
  }
  return found;
}

describe('landmarks', () => {
  const found = onePerKind();

  test.each(KINDS)('a %s keeps what blocks inside its footprint, clear of the road', (kind) => {
    const [rx, ry] = POI_KINDS[kind].reach;
    const outside = POI_KINDS[kind].landmark.filter(
      ({ dx, dy, feature }) =>
        BLOCKING_FEATURES.has(feature) &&
        ((Math.abs(dx) + 1) / rx) ** 2 + ((Math.abs(dy) + 1) / ry) ** 2 >= 1,
    );
    expect(outside).toEqual([]);
  });

  test.each(KINDS)('a %s shows its landmark', (kind) => {
    const { world, poi } = found.get(kind)!;
    const at = tiles(world);
    let marks = 0;
    let shown = 0;
    for (const { dx, dy } of POI_KINDS[kind].landmark) {
      const gtx = Math.floor(poi.x) + dx;
      const gty = Math.floor(poi.y) + dy;
      const mark = landmarkAt(poi, gtx, gty);
      if (!mark || !BLOCKING_FEATURES.has(mark)) continue;
      marks++;
      if (at(gtx, gty) === mark) shown++;
    }
    expect(marks).toBeGreaterThan(0);
    expect(shown / marks).toBeGreaterThan(0.5);
  });

  test.each(['graveyard', 'burialground'] as const)(
    'a %s is reached by a road and keeps every grave and fence it rolls, so none shuts a tile in',
    (kind) => {
      const { world, poi } = found.get(kind)!;
      const at = tiles(world);
      const rolled: Feature[] = [];
      const missing: string[] = [];
      for (const { dx, dy } of POI_KINDS[kind].landmark) {
        const gtx = Math.floor(poi.x) + dx;
        const gty = Math.floor(poi.y) + dy;
        const mark = landmarkAt(poi, gtx, gty);
        if (!mark || !BLOCKING_FEATURES.has(mark)) continue;
        rolled.push(mark);
        if (at(gtx, gty) !== mark) missing.push(`${dx},${dy} ${mark}`);
      }
      expect(rolled.filter((f) => f === 'grave').length).toBeGreaterThan(4);
      expect(missing).toEqual([]);
      const roads = networkOf(world, OVERWORLD).roadsIn({
        x0: poi.x,
        y0: poi.y,
        x1: poi.x,
        y1: poi.y,
      });
      expect(roads.some((r) => r.a === poi || r.b === poi)).toBe(true);
    },
  );

  test('stand whole within one screen, unless the footprint is too big for one', () => {
    const split: string[] = [];
    for (const { poi } of found.values()) {
      const [rx, ry] = poi.reach;
      const within = (v: number, r: number, size: number) => {
        const s0 = Math.floor(v / size) * size;
        return 2 * (r + 1) > size || (v - r - 1 >= s0 && v + r + 1 <= s0 + size);
      };
      if (!within(poi.x, rx, SCREEN_W) || !within(poi.y, ry, SCREEN_H)) split.push(poi.kind);
    }
    expect(split).toEqual([]);
  });

  test('never block a road', () => {
    const blocked: string[] = [];
    for (const { world, poi } of found.values()) {
      const at = tiles(world);
      const [rx, ry] = poi.reach;
      const box = {
        x0: poi.x - rx - 1,
        y0: poi.y - ry - 1,
        x1: poi.x + rx + 1,
        y1: poi.y + ry + 1,
      };
      const plan = networkOf(world, OVERWORLD).plan(box);
      for (let gty = Math.floor(box.y0); gty < box.y1; gty++) {
        for (let gtx = Math.floor(box.x0); gtx < box.x1; gtx++) {
          const onRoad = [0, 1].some((dy) => [0, 1].some((dx) => plan.road(gtx + dx, gty + dy)));
          if (onRoad && BLOCKING_FEATURES.has(at(gtx, gty)))
            blocked.push(`${poi.kind} ${gtx},${gty}`);
        }
      }
    }
    expect(blocked).toEqual([]);
  });
});

describe('biome dressing', () => {
  const screens = sampled(worldOf(1));
  const share = (biome: string, feature: Feature) => {
    const of = screens.filter((s) => s.biome === biome).flatMap((s) => s.features);
    return of.filter((f) => f === feature).length / of.length;
  };

  test('fills forests and taiga with trees', () => {
    expect(share('forest', 'tree')).toBeGreaterThan(0.2);
    expect(share('taiga', 'tree')).toBeGreaterThan(0.2);
    expect(share('meadow', 'tree')).toBeLessThan(0.1);
  });

  test('grows bushes along the edge of the woods, more than in the open', () => {
    let edge = 0;
    let edgeBushes = 0;
    let open = 0;
    let openBushes = 0;
    for (const s of screens.filter((s) => s.biome !== 'scrubland' && s.biome !== 'desert')) {
      for (let ty = 3; ty < SCREEN_H - 3; ty++) {
        for (let tx = 3; tx < SCREEN_W - 3; tx++) {
          const feature = featureAt(s, tx, ty);
          if (feature === 'tree') continue;
          let trees = 0;
          for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) if (featureAt(s, tx + dx, ty + dy) === 'tree') trees++;
          }
          if (trees >= 3 && trees <= 12) {
            edge++;
            if (feature === 'bush') edgeBushes++;
          } else if (trees === 0) {
            open++;
            if (feature === 'bush') openBushes++;
          }
        }
      }
    }
    expect(edgeBushes / edge).toBeGreaterThan(3 * (openBushes / open));
  });

  test('gathers scrubland bushes into thickets', () => {
    const thick = screens
      .filter((s) => s.biome === 'scrubland')
      .filter((s) => {
        for (let ty = 0; ty + 4 <= SCREEN_H; ty++) {
          for (let tx = 0; tx + 4 <= SCREEN_W; tx++) {
            let bushes = 0;
            for (let y = ty; y < ty + 4; y++) {
              for (let x = tx; x < tx + 4; x++) if (featureAt(s, x, y) === 'bush') bushes++;
            }
            if (bushes >= 6) return true;
          }
        }
        return false;
      });
    expect(thick.length).toBeGreaterThan(3);
  });

  test('scatters bones across the desert, a few in scrubland and tundra, none in lush lands', () => {
    const bones = (biome: string) => {
      const of = screens.filter((s) => s.biome === biome);
      const counts = of.map((s) => s.features.filter((f) => f === 'bones').length);
      return {
        perScreen: counts.reduce((a, b) => a + b, 0) / of.length,
        showing: counts.filter((n) => n > 0).length / of.length,
      };
    };
    expect(bones('desert').showing).toBeGreaterThan(0.6);
    for (const dry of ['scrubland', 'tundra']) {
      expect(bones(dry).perScreen).toBeGreaterThan(0);
      expect(bones(dry).perScreen).toBeLessThan(bones('desert').perScreen / 3);
    }
    for (const lush of ['meadow', 'forest', 'lakeland', 'highlands', 'taiga']) {
      expect(bones(lush).perScreen, lush).toBe(0);
    }
  });
});

describe('lakes', () => {
  // The halves share four screens of rows, far more than the widest lake allowed, so a lake too
  // wide for the rule still crosses that whole band in one half and shows as too wide there.
  test.each([
    [-24, 2],
    [-2, 24],
  ])('never span more than about a screen and a third, rows %i to %i', (sy0, sy1) => {
    const land = landFor(worldOf(1), OVERWORLD);
    const lake = (x: number, y: number) => land.waterDepth(x, y) > 0 && land.riverDepth(x, y) <= 0;
    const [x0, y0, w, h] = [-24 * SCREEN_W, sy0 * SCREEN_H, 48 * SCREEN_W, (sy1 - sy0) * SCREEN_H];
    const wet = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) wet[y * w + x] = lake(x0 + x, y0 + y) ? 1 : 0;
    }
    let lakes = 0;
    const spans: number[] = [];
    for (let i = 0; i < wet.length; i++) {
      if (wet[i] !== 1) continue;
      lakes++;
      let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
      const stack = [i];
      wet[i] = 2;
      while (stack.length > 0) {
        const j = stack.pop()!;
        const x = j % w;
        const y = Math.floor(j / w);
        [minX, maxX, minY, maxY] = [
          Math.min(minX, x),
          Math.max(maxX, x),
          Math.min(minY, y),
          Math.max(maxY, y),
        ];
        for (const k of [j - 1, j + 1, j - w, j + w]) {
          if (k < 0 || k >= wet.length || Math.abs((k % w) - x) > 1 || wet[k] !== 1) continue;
          wet[k] = 2;
          stack.push(k);
        }
      }
      spans.push(Math.max(maxX - minX, maxY - minY));
    }
    expect(lakes).toBeGreaterThan(10);
    expect(Math.max(...spans)).toBeLessThanOrEqual(26);
  });
});
