import { describe, expect, test } from 'vitest';
import { GARDEN_COORD } from './garden.ts';
import { BIOME_PARAMS } from './biome.ts';
import { generateScreen, landFor, networkOf } from './generate.ts';
import { POI_KINDS, REGION_H, REGION_W, inFootprint, type Land, type Poi } from './poi.ts';
import { roadNetwork, type Box, type Network, type Plan, type Road } from './roads.ts';
import { worldOf } from './testing.ts';
import { isTileWalkable } from './walk.ts';
import {
  BLOCKING_FEATURES,
  LATTICE_H,
  LATTICE_W,
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  chunkScreens,
  cornerAt,
  featureAt,
  screenKey,
  type Screen,
  type ScreenCoord,
} from './world.ts';

const SEEDS = [3, 1000 + 7919, 1000 + 4 * 7919];

const screenBox = ({ sx, sy }: { sx: number; sy: number }): Box => ({
  x0: sx * SCREEN_W,
  y0: sy * SCREEN_H,
  x1: (sx + 1) * SCREEN_W,
  y1: (sy + 1) * SCREEN_H,
});

function maskOf(plan: Plan, { sx, sy }: ScreenCoord): boolean[] {
  const mask: boolean[] = [];
  for (let cy = 0; cy < LATTICE_H; cy++) {
    for (let cx = 0; cx < LATTICE_W; cx++)
      mask.push(plan.road(sx * SCREEN_W + cx, sy * SCREEN_H + cy));
  }
  return mask;
}

/** Every road lattice point of each screen, as its network sees the screen on its own. */
function roadMasks(network: Network, coords: readonly ScreenCoord[]): Map<string, boolean[]> {
  return new Map(coords.map((c) => [screenKey(c), maskOf(network.plan(screenBox(c)), c)]));
}

const chunk = (cx: number, cy: number) => chunkScreens({ layer: OVERWORLD, cx, cy });

/** Map points along each road, one per lattice unit. */
function roadPoints(roads: readonly Road[]): [number, number][] {
  const points: [number, number][] = [];
  for (const { path } of roads) {
    for (let i = 0; i < path.length - 1; i++) {
      const [p, q] = [path[i]!, path[i + 1]!];
      const steps = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y));
      for (let s = 0; s < steps; s++) {
        points.push([p.x + ((q.x - p.x) * s) / steps, p.y + ((q.y - p.y) * s) / steps]);
      }
    }
  }
  return points;
}

function portIndex(hub: Poi, road: Road): number {
  const end = road.a === hub ? road.path[0]! : road.path[road.path.length - 1]!;
  return hub.ports.findIndex((p) => p.x === end.x && p.y === end.y);
}

describe.each(SEEDS)('the road network of seed %i', (seed) => {
  const world = worldOf(seed);
  const network = networkOf(world, OVERWORLD);

  test('is the same whatever order fresh networks meet its chunks in, and agrees across seams', () => {
    const range = [-2, -1, 0, 1];
    const chunks = range.flatMap((cy) => range.map((cx) => [cx, cy] as const));
    const forward = chunks.flatMap(([cx, cy]) => chunk(cx, cy));
    const backward = [...chunks].reverse().flatMap(([cx, cy]) => chunk(cx, cy).reverse());
    const first = roadNetwork(landFor(world, OVERWORLD));
    const a = roadMasks(first, forward);
    const b = roadMasks(roadNetwork(landFor(world, OVERWORLD)), backward);
    expect(new Map([...b].sort())).toEqual(new Map([...a].sort()));

    const whole = first.plan({
      x0: -8 * SCREEN_W,
      y0: -8 * SCREEN_H,
      x1: 8 * SCREEN_W,
      y1: 8 * SCREEN_H,
    });
    const differ = forward.filter((c) => maskOf(whole, c).join() !== a.get(screenKey(c))!.join());
    expect(differ).toEqual([]);
    expect([...a.values()].flat().filter(Boolean).length).toBeGreaterThan(16 * 16 * 10);
  });

  test('lays its roads as path, sand where they ford water, and path nowhere else', () => {
    const coords = [chunk(1, 1), chunk(-2, 0), chunk(0, -2)].flat();
    const wrong: string[] = [];
    let path = 0;
    for (const coord of coords) {
      const screen = generateScreen(world, coord);
      const road = maskOf(network.plan(screenBox(coord)), coord);
      screen.corners.forEach((t, i) => {
        if (t === 'path') path++;
        if (road[i] ? t !== 'path' && t !== 'sand' : t === 'path') {
          wrong.push(`${screenKey(coord)} ${i} ${road[i] ? 'road' : 'off road'} ${t}`);
        }
      });
    }
    expect(wrong).toEqual([]);
    expect(path).toBeGreaterThan(100);
  });

  test('joins every point of interest to the garden with a sparse network', () => {
    const region = (r: number): Box => ({
      x0: -r * REGION_W,
      y0: -r * REGION_H,
      x1: r * REGION_W,
      y1: r * REGION_H,
    });
    const roads = network.roadsIn(region(6));
    const next = new Map<Poi, Poi[]>();
    for (const { a, b } of roads) {
      next.set(a, [...(next.get(a) ?? []), b]);
      next.set(b, [...(next.get(b) ?? []), a]);
    }
    const hub = [...next.keys()].find((p) => p.kind === 'hub')!;
    const reached = new Set([hub]);
    const queue = [hub];
    for (let p = queue.pop(); p; p = queue.pop()) {
      for (const q of next.get(p) ?? []) {
        if (reached.has(q)) continue;
        reached.add(q);
        queue.push(q);
      }
    }
    const near = network.poisIn(region(3));
    expect(near.length).toBeGreaterThan(30);
    expect(near.filter((p) => !reached.has(p)).map((p) => p.region)).toEqual([]);
    expect(roads.length / next.size).toBeLessThan(1.6);
  });

  test('keeps its roads off the lakes, which never cut the land apart', () => {
    const land = landFor(world, OVERWORLD);
    const box: Box = { x0: -2 * REGION_W, y0: -2 * REGION_H, x1: 2 * REGION_W, y1: 2 * REGION_H };
    const points = roadPoints(network.roadsIn(box));
    let water = 0;
    let area = 0;
    for (let gy = box.y0; gy < box.y1; gy += 3) {
      for (let gx = box.x0; gx < box.x1; gx += 3) {
        area++;
        if (land.waterDepth(gx, gy) > 0) water++;
      }
    }
    expect(points.length).toBeGreaterThan(1000);
    expect(water / area).toBeGreaterThan(0.01);
    expect(points.filter(([x, y]) => land.waterDepth(x, y) > 0)).toEqual([]);
  });
});

test.each([1, 2, 3, 4, 5, 6, 7, 8])('roads leave all four garden exits in seed %i', (seed) => {
  const network = networkOf(worldOf(seed), OVERWORLD);
  const hub = network.poisIn(screenBox(GARDEN_COORD)).find((p) => p.kind === 'hub')!;
  expect(hub.ports).toHaveLength(4);
  const roads = network.roadsIn(screenBox(GARDEN_COORD)).filter((r) => r.a === hub || r.b === hub);
  expect([...new Set(roads.map((r) => portIndex(hub, r)))].sort()).toEqual([0, 1, 2, 3]);
  for (const road of roads) {
    const other = road.a === hub ? road.b : road.a;
    const end = road.a === hub ? road.path[road.path.length - 1]! : road.path[0]!;
    expect([end.x, end.y]).toEqual([other.x, other.y]);
  }
});

describe('across a river', () => {
  /** Meadow everywhere, with water from x = 60 to 68 except where `gap` says. */
  const riverLand = (gap: (y: number) => boolean): Land => ({
    seed: 5,
    biome: () => ({ biome: 'meadow', cell: { x: 0, y: 0 }, params: BIOME_PARAMS.meadow }),
    waterDepth: (x, y) => (gap(y) ? -10 : Math.min(x - 60, 68 - x)),
    woods: () => 0,
    stamps: [],
  });
  const crossing = (network: Network) => {
    const roads = network
      .roadsIn({ x0: 60, y0: -REGION_H, x1: 68, y1: 2 * REGION_H })
      .filter(({ a, b }) => a.x < 60 !== b.x < 60);
    return {
      roads,
      wet: (land: Land) => roadPoints(roads).filter(([x, y]) => land.waterDepth(x, y) > 0),
    };
  };

  test('a road fords it straight across when there is no way round', () => {
    const land = riverLand(() => false);
    const { roads, wet } = crossing(roadNetwork(land));
    expect(roads.length).toBeGreaterThan(0);
    const fords = wet(land);
    expect(fords.length).toBeGreaterThan(0);
    expect(fords.length).toBeLessThan(roads.length * 20);
  });

  test('a road goes round through a gap nearby', () => {
    const land = riverLand((y) => y > 5 && y < 25);
    const { roads, wet } = crossing(roadNetwork(land));
    const near = roads.filter(({ a, b }) => Math.abs(a.y - 15) < 30 && Math.abs(b.y - 15) < 30);
    expect(near.length).toBeGreaterThan(0);
    expect(wet(land).filter(([, y]) => Math.abs(y - 15) < 40)).toEqual([]);
  });
});

describe('points of interest', () => {
  const world = worldOf(1000 + 7919);
  const network = networkOf(world, OVERWORLD);
  const box: Box = { x0: -4 * REGION_W, y0: -4 * REGION_H, x1: 4 * REGION_W, y1: 4 * REGION_H };
  const pois = network.poisIn(box).filter((p) => p.kind !== 'hub');

  test('come in several kinds from the registry', () => {
    const kinds = new Set(pois.map((p) => p.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    for (const kind of kinds) expect(Object.keys(POI_KINDS)).toContain(kind);
  });

  test('reserve a flat, open footprint, blocked only by its landmark, that a road reaches', () => {
    const problems: string[] = [];
    const screens = new Map<string, Screen>();
    const screenOf = (gx: number, gy: number) => {
      const coord = {
        layer: OVERWORLD,
        sx: Math.floor(gx / SCREEN_W),
        sy: Math.floor(gy / SCREEN_H),
      };
      let screen = screens.get(screenKey(coord));
      if (!screen) screens.set(screenKey(coord), (screen = generateScreen(world, coord)));
      return { screen, x: gx - coord.sx * SCREEN_W, y: gy - coord.sy * SCREEN_H };
    };
    const corner = (gx: number, gy: number) => {
      const { screen, x, y } = screenOf(gx, gy);
      return cornerAt(screen, x, y);
    };
    for (const poi of pois.slice(0, 12)) {
      const [rx, ry] = poi.reach;
      for (let gty = Math.floor(poi.y - ry); gty <= poi.y + ry; gty++) {
        for (let gtx = Math.floor(poi.x - rx); gtx <= poi.x + rx; gtx++) {
          const corners = [
            [gtx, gty],
            [gtx + 1, gty],
            [gtx, gty + 1],
            [gtx + 1, gty + 1],
          ] as const;
          if (!corners.every(([x, y]) => inFootprint(poi, x, y))) continue;
          const where = `${poi.kind} at ${gtx},${gty}`;
          const ground = corners.map(([x, y]) => corner(x, y));
          if (!ground.every((t) => t === poi.ground || t === 'path' || t === 'sand')) {
            problems.push(`${where}: ground ${ground.join()}`);
          }
          const { screen, x, y } = screenOf(gtx, gty);
          if (network.plan({ x0: gtx, y0: gty, x1: gtx + 1, y1: gty + 1 }).landmark(gtx, gty)) {
            continue;
          }
          if (BLOCKING_FEATURES.has(featureAt(screen, x, y))) problems.push(`${where}: blocked`);
          if (!isTileWalkable(screen, x, y)) problems.push(`${where}: not walkable`);
        }
      }
      const reached = network
        .roadsIn({ x0: poi.x, y0: poi.y, x1: poi.x, y1: poi.y })
        .some((r) => r.a === poi || r.b === poi);
      if (!reached) problems.push(`${poi.kind} at ${poi.x},${poi.y}: no road`);
    }
    expect(problems).toEqual([]);
  });
});
