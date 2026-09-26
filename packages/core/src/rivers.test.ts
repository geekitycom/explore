import { describe, expect, test } from 'vitest';
import { STITCH_REACH, fieldTerrain, generateScreen, landFor, networkOf } from './generate.ts';
import { uniformScreen, worldOf } from './testing.ts';
import { isTileWalkable } from './walk.ts';
import {
  CHUNK_H,
  CHUNK_W,
  LATTICE_H,
  LATTICE_W,
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  cornerAt,
  tileCorners,
  type Screen,
  type ScreenCoord,
  type World,
} from './world.ts';

const SEEDS = [1, 2, 3];
/** 36 screens square around the garden, in lattice points. */
const AREA = { x0: -18 * SCREEN_W, y0: -18 * SCREEN_H, w: 36 * SCREEN_W, h: 36 * SCREEN_H };

function riverOf(world: World): (gx: number, gy: number) => boolean {
  const land = landFor(world, OVERWORLD);
  return (gx, gy) => land.riverDepth(gx, gy) > 0;
}

/** Each river's water as one 4-connected set of lattice points, by its span in points. */
function riverSpans(world: World): number[] {
  const river = riverOf(world);
  const { x0, y0, w, h } = AREA;
  const wet = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) wet[y * w + x] = +river(x0 + x, y0 + y);
  const spans: number[] = [];
  for (let i = 0; i < wet.length; i++) {
    if (wet[i] !== 1) continue;
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
    const stack = [i];
    wet[i] = 2;
    while (stack.length > 0) {
      const j = stack.pop()!;
      const [x, y] = [j % w, Math.floor(j / w)];
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
  return spans;
}

/** The screen coordinates whose lattice holds river water, within AREA. */
function riverScreens(world: World): ScreenCoord[] {
  const river = riverOf(world);
  const found: ScreenCoord[] = [];
  for (let sy = AREA.y0 / SCREEN_H; sy < (AREA.y0 + AREA.h) / SCREEN_H; sy++) {
    for (let sx = AREA.x0 / SCREEN_W; sx < (AREA.x0 + AREA.w) / SCREEN_W; sx++) {
      let wet = false;
      for (let cy = 0; cy < LATTICE_H && !wet; cy += 2) {
        for (let cx = 0; cx < LATTICE_W && !wet; cx += 2)
          wet = river(sx * SCREEN_W + cx, sy * SCREEN_H + cy);
      }
      if (wet) found.push({ layer: OVERWORLD, sx, sy });
    }
  }
  return found;
}

describe.each(SEEDS)('the rivers of seed %i', (seed) => {
  const world = worldOf(seed);
  const river = riverOf(world);
  const wetScreens = riverScreens(world);

  test('wind across several screens', () => {
    const spans = riverSpans(world);
    expect(spans.filter((s) => s >= 3 * SCREEN_W).length).toBeGreaterThanOrEqual(4);
  });

  // Each half's screens are made in two parts, in order, so each test stays well inside the budget.
  test.each([
    ['north', 1],
    ['north', 2],
    ['south', 1],
    ['south', 2],
  ] as const)(
    'run on unbroken across screen and chunk seams in the %s, whichever screen is made first, part %i of 2',
    (half, part) => {
      // A checkerboard still puts one side of every seam between river screens under test.
      const coords = wetScreens.filter(
        ({ sx, sy }) => ((sx + sy) & 1) === 0 && sy < 0 === (half === 'north'),
      );
      const chunks = new Set(
        coords.map(({ sx, sy }) => `${Math.floor(sx / CHUNK_W)},${Math.floor(sy / CHUNK_H)}`),
      );
      expect(chunks.size).toBeGreaterThan(1);
      const order = [...coords].reverse();
      const size = Math.ceil(order.length / 2);
      const broken: string[] = [];
      for (const coord of order.slice((part - 1) * size, part * size)) {
        const screen = generateScreen(world, coord);
        for (let cy = 0; cy < LATTICE_H; cy++) {
          for (let cx = 0; cx < LATTICE_W; cx++) {
            const gx = coord.sx * SCREEN_W + cx;
            const gy = coord.sy * SCREEN_H + cy;
            const wet = cornerAt(screen, cx, cy) === 'water';
            if (wet !== (fieldTerrain(world, OVERWORLD, gx, gy) === 'water'))
              broken.push(`${gx},${gy}`);
          }
        }
      }
      expect(broken).toEqual([]);
    },
  );

  // Built here, outside the test's time: the water of every lattice point of AREA.
  const wetPoints = (() => {
    const land = landFor(world, OVERWORLD);
    const { x0, y0, w, h } = AREA;
    const points = new Uint8Array((w + 1) * (h + 1));
    for (let y = 0; y <= h; y++) {
      for (let x = 0; x <= w; x++) points[y * (w + 1) + x] = +(land.waterDepth(x0 + x, y0 + y) > 0);
    }
    return points;
  })();

  test('never shut any land away, so no one is trapped', () => {
    const { x0, y0, w, h } = AREA;
    const wet = (x: number, y: number) => wetPoints[y * (w + 1) + x]!;
    const open = new Uint8Array(w * h);
    for (let ty = 0; ty < h; ty++) {
      for (let tx = 0; tx < w; tx++) {
        const water = wet(tx, ty) + wet(tx + 1, ty) + wet(tx, ty + 1) + wet(tx + 1, ty + 1);
        open[ty * w + tx] = water < 3 ? 1 : 0;
      }
    }
    const stack: number[] = [];
    for (let i = 0; i < open.length; i++) {
      const [x, y] = [i % w, Math.floor(i / w)];
      if (open[i] === 1 && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) {
        open[i] = 2;
        stack.push(i);
      }
    }
    while (stack.length > 0) {
      const j = stack.pop()!;
      const x = j % w;
      for (const k of [j - 1, j + 1, j - w, j + w]) {
        if (k < 0 || k >= open.length || Math.abs((k % w) - x) > 1 || open[k] !== 1) continue;
        open[k] = 2;
        stack.push(k);
      }
    }
    const cutOff = [...open.keys()].filter((i) => open[i] === 1);
    expect(cutOff.map((i) => `${x0 + (i % w)},${y0 + Math.floor(i / w)}`)).toEqual([]);
  });

  test('are crossed by roads only at walkable sand fords', () => {
    const box = { x0: AREA.x0, y0: AREA.y0, x1: AREA.x0 + AREA.w, y1: AREA.y0 + AREA.h };
    const screens = new Map<string, Screen>();
    const screenAt = (sx: number, sy: number) => {
      const key = `${sx},${sy}`;
      if (!screens.has(key)) screens.set(key, generateScreen(world, { layer: OVERWORLD, sx, sy }));
      return screens.get(key)!;
    };
    const wet: string[] = [];
    let fords = 0;
    let sand = 0;
    for (const { path } of networkOf(world, OVERWORLD).roadsIn(box)) {
      for (let i = 0; i < path.length - 1; i++) {
        const [p, q] = [path[i]!, path[i + 1]!];
        const steps = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) * 2);
        for (let s = 0; s < steps; s++) {
          const gx = p.x + ((q.x - p.x) * s) / steps;
          const gy = p.y + ((q.y - p.y) * s) / steps;
          if (!river(gx, gy)) continue;
          fords++;
          const [gtx, gty] = [Math.floor(gx), Math.floor(gy)];
          const [sx, sy] = [Math.floor(gtx / SCREEN_W), Math.floor(gty / SCREEN_H)];
          const screen = screenAt(sx, sy);
          const [tx, ty] = [gtx - sx * SCREEN_W, gty - sy * SCREEN_H];
          const corners = tileCorners(screen, tx, ty);
          sand += corners.filter((t) => t === 'sand').length;
          if (corners.includes('water') || !isTileWalkable(screen, tx, ty)) {
            wet.push(`${gtx},${gty} ${corners.join('/')}`);
          }
        }
      }
    }
    expect(wet).toEqual([]);
    expect(fords).toBeGreaterThan(0);
    expect(sand).toBeGreaterThan(0);
  });
});

test('a river that reaches an older stored screen ends in the blend band before it', () => {
  const world = worldOf(1);
  const river = riverOf(world);
  const coord = riverScreens(world).find(({ sx, sy }) => {
    let wet = 0;
    for (let cy = 0; cy < LATTICE_H; cy++)
      if (river((sx + 1) * SCREEN_W - 1, sy * SCREEN_H + cy)) wet++;
    return wet >= 2;
  })!;
  expect(coord).toBeDefined();
  const east = { ...uniformScreen('grass'), coord: { ...coord, sx: coord.sx + 1 } };
  const older = (c: ScreenCoord) =>
    c.sx === east.coord.sx && c.sy === east.coord.sy ? east : undefined;
  const screen = generateScreen(world, coord, older);
  const band: string[] = [];
  let beyond = 0;
  for (let cy = 0; cy < LATTICE_H; cy++) {
    for (let cx = 0; cx < LATTICE_W; cx++) {
      const wet = cornerAt(screen, cx, cy) === 'water';
      if (SCREEN_W - cx < STITCH_REACH && wet) band.push(`${cx},${cy}`);
      if (SCREEN_W - cx >= STITCH_REACH && wet) beyond++;
    }
  }
  expect(band).toEqual([]);
  expect(beyond).toBeGreaterThan(0);
  const walkable = Array.from({ length: SCREEN_H }, (_, ty) => ty).filter((ty) =>
    isTileWalkable(screen, SCREEN_W - 1, ty),
  );
  expect(walkable.length).toBeGreaterThan(0);
});
