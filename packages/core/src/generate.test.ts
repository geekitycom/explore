import { describe, expect, test } from 'vitest';
import { GARDEN_COORD, secretGarden } from './garden.ts';
import {
  STITCH_REACH,
  crossingTiles,
  fieldTerrain,
  generateScreen,
  networkOf,
  type Older,
} from './generate.ts';
import { createRng } from './rng.ts';
import { generateRegion, worldOf, type Region } from './testing.ts';
import { isTileWalkable } from './walk.ts';
import {
  DIRS,
  DIR_DELTA,
  LATTICE_H,
  LATTICE_W,
  OPPOSITE,
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  cornerAt,
  neighborCoord,
  screenKey,
  tileCorners,
  type Dir,
  type LayerId,
  type Screen,
  type ScreenCoord,
  type World,
} from './world.ts';

const SEEDS = [1, 2, 3, 4, 5, 6].map((i) => 1000 + i * 7919);
const REGION: Region = { x0: -6, y0: -6, w: 12, h: 12 };

type Tile = readonly [number, number];

const OFFSETS = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ dx, dy })));

function seamMismatches(screens: ReadonlyMap<string, Screen>): string[] {
  const mismatches: string[] = [];
  for (const screen of screens.values()) {
    for (const { dx, dy } of OFFSETS) {
      if (dx === 0 && dy === 0) continue;
      const { layer, sx, sy } = screen.coord;
      const other = screens.get(screenKey({ layer, sx: sx + dx, sy: sy + dy }));
      if (!other) continue;
      for (let cy = 0; cy < LATTICE_H; cy++) {
        for (let cx = 0; cx < LATTICE_W; cx++) {
          const ox = cx - dx * SCREEN_W;
          const oy = cy - dy * SCREEN_H;
          if (ox < 0 || oy < 0 || ox >= LATTICE_W || oy >= LATTICE_H) continue;
          if (cornerAt(screen, cx, cy) !== cornerAt(other, ox, oy)) {
            mismatches.push(`${screenKey(screen.coord)} (${cx},${cy}) vs ${dx},${dy}`);
          }
        }
      }
    }
  }
  return mismatches;
}

function facing(dir: Dir, [tx, ty]: Tile): Tile {
  const { dx, dy } = DIR_DELTA[dir];
  return [tx - dx * (SCREEN_W - 1), ty - dy * (SCREEN_H - 1)];
}

function edgeTiles(dir: Dir): Tile[] {
  switch (dir) {
    case 'n':
      return Array.from({ length: SCREEN_W }, (_, x) => [x, 0]);
    case 's':
      return Array.from({ length: SCREEN_W }, (_, x) => [x, SCREEN_H - 1]);
    case 'w':
      return Array.from({ length: SCREEN_H }, (_, y) => [0, y]);
    case 'e':
      return Array.from({ length: SCREEN_H }, (_, y) => [SCREEN_W - 1, y]);
  }
}

/** Corner tiles sit on two seams, so a crossing there belongs to either. */
function isCornerTile(tx: number, ty: number): boolean {
  return (tx === 0 || tx === SCREEN_W - 1) && (ty === 0 || ty === SCREEN_H - 1);
}

function terrainWalkable(screen: Screen, tx: number, ty: number): boolean {
  return tileCorners(screen, tx, ty).filter((t) => t === 'water').length < 3;
}

function components(walkable: (tx: number, ty: number) => boolean): number[] {
  const comp = Array<number>(SCREEN_W * SCREEN_H).fill(-1);
  let next = 0;
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      if (comp[ty * SCREEN_W + tx] !== -1 || !walkable(tx, ty)) continue;
      const stack: Tile[] = [[tx, ty]];
      comp[ty * SCREEN_W + tx] = next;
      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1],
        ] as const) {
          if (nx < 0 || ny < 0 || nx >= SCREEN_W || ny >= SCREEN_H) continue;
          if (comp[ny * SCREEN_W + nx] !== -1 || !walkable(nx, ny)) continue;
          comp[ny * SCREEN_W + nx] = next;
          stack.push([nx, ny]);
        }
      }
      next++;
    }
  }
  return comp;
}

function reachableScreens(world: World, screens: ReadonlyMap<string, Screen>): Set<string> {
  const garden = screens.get(screenKey(GARDEN_COORD))!;
  const seen = new Set<string>();
  const queue: { screen: Screen; tile: Tile }[] = [];
  const visit = (screen: Screen, tile: Tile) => {
    const key = `${screenKey(screen.coord)}:${tile.join(',')}`;
    if (seen.has(key) || !isTileWalkable(screen, ...tile)) return;
    seen.add(key);
    queue.push({ screen, tile });
  };
  crossingTiles(world, garden.coord).forEach((t) => visit(garden, t));
  const reached = new Set<string>();
  for (let next = queue.shift(); next; next = queue.shift()) {
    const { screen, tile } = next;
    reached.add(screenKey(screen.coord));
    const [x, y] = tile;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx >= 0 && ny >= 0 && nx < SCREEN_W && ny < SCREEN_H) visit(screen, [nx, ny]);
    }
    for (const dir of DIRS) {
      if (!edgeTiles(dir).some(([tx, ty]) => tx === x && ty === y)) continue;
      const other = screens.get(screenKey(neighborCoord(screen.coord, dir)));
      if (other) visit(other, facing(dir, tile));
    }
  }
  return reached;
}

function shuffled<T>(items: readonly T[], seed: number): T[] {
  const rng = createRng(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe.each(SEEDS)('a world with seed %i', (seed) => {
  const world = worldOf(seed);
  const screens = generateRegion(world, REGION);

  test('agrees on every shared lattice point whatever order screens are generated in', () => {
    const coords = [...screens.values()].map((s) => s.coord);
    for (const order of [shuffled(coords, 1), shuffled(coords, 2)]) {
      const again = new Map<string, Screen>();
      for (const coord of order) again.set(screenKey(coord), generateScreen(world, coord));
      expect(seamMismatches(again)).toEqual([]);
      for (const [key, screen] of screens) expect(again.get(key)).toEqual(screen);
    }
  });

  test('gives every seam a crossing that is open on both sides, unless water blocks it entirely', () => {
    const problems: string[] = [];
    for (const screen of screens.values()) {
      const crossings = crossingTiles(world, screen.coord);
      for (const dir of ['e', 's'] as const) {
        const other = screens.get(screenKey(neighborCoord(screen.coord, dir)));
        if (!other) continue;
        const back = OPPOSITE[dir];
        const along = (edge: Dir, tiles: readonly Tile[]) =>
          tiles.filter((t) => edgeTiles(edge).some((e) => e.join() === t.join()));
        const ours = along(dir, crossings);
        const theirs = along(back, crossingTiles(world, other.coord)).map((t) => facing(back, t));
        const inner = (tiles: readonly Tile[]) =>
          tiles
            .filter(([tx, ty]) => !isCornerTile(tx, ty))
            .map((t) => t.join(','))
            .sort()
            .join(' ');
        if (inner(ours) !== inner(theirs)) {
          problems.push(`${screenKey(screen.coord)} ${dir}: sides disagree`);
        }
        const isOpen = (t: Tile) =>
          isTileWalkable(screen, ...t) && isTileWalkable(other, ...facing(dir, t));
        if (!ours.filter(([tx, ty]) => !isCornerTile(tx, ty)).every(isOpen)) {
          problems.push(`${screenKey(screen.coord)} ${dir}: a crossing is blocked`);
        }
        const open = ours.filter(isOpen);
        const crossable = edgeTiles(dir).some(
          (t) => terrainWalkable(screen, ...t) && terrainWalkable(other, ...facing(dir, t)),
        );
        if (crossable && open.length === 0)
          problems.push(`${screenKey(screen.coord)} ${dir}: closed`);
      }
    }
    expect(problems).toEqual([]);
  });

  test('joins the crossings of each stretch of land within every screen', () => {
    const split: string[] = [];
    for (const screen of screens.values()) {
      const land = components((tx, ty) => terrainWalkable(screen, tx, ty));
      const walk = components((tx, ty) => isTileWalkable(screen, tx, ty));
      const byLand = new Map<number, number>();
      for (const [tx, ty] of crossingTiles(world, screen.coord)) {
        const i = ty * SCREEN_W + tx;
        if (walk[i] === -1) continue;
        const seen = byLand.get(land[i]!);
        if (seen !== undefined && seen !== walk[i]) split.push(`${screenKey(screen.coord)}`);
        byLand.set(land[i]!, walk[i]!);
      }
    }
    expect(split).toEqual([]);
  });

  test('joins every walkable pocket to a crossing, so no walkable tile is out of reach', () => {
    const stranded: string[] = [];
    for (const screen of screens.values()) {
      const walk = components((tx, ty) => isTileWalkable(screen, tx, ty));
      const reached = new Set(
        crossingTiles(world, screen.coord).map(([tx, ty]) => walk[ty * SCREEN_W + tx]),
      );
      for (const id of new Set(walk)) {
        if (id !== -1 && !reached.has(id)) stranded.push(`${screenKey(screen.coord)} ${id}`);
      }
    }
    expect(stranded).toEqual([]);
  });

  test('reaches every screen of the region from the garden on foot', () => {
    const reached = reachableScreens(world, screens);
    expect([...screens.keys()].filter((k) => !reached.has(k))).toEqual([]);
  });
});

/**
 * Screens an older generator left behind, stood in for by another world's screens with their
 * land turned to snow: they agree among themselves, touch the garden at its corner, and match
 * nothing this world's fields would make.
 */
const OLD_BLOCK: Region = { x0: 1, y0: 1, w: 3, h: 3 };

function mixedWorld(seed: number) {
  const world = worldOf(seed);
  // Points on the garden's own lattice stay, since stored screens always agree with the garden.
  const snowed = (s: Screen): Screen => ({
    ...s,
    corners: s.corners.map((t, i) => {
      const gx = s.coord.sx * SCREEN_W + (i % LATTICE_W);
      const gy = s.coord.sy * SCREEN_H + Math.floor(i / LATTICE_W);
      const onGarden = gx >= 0 && gx <= SCREEN_W && gy >= 0 && gy <= SCREEN_H;
      return t === 'water' || onGarden ? t : 'snow';
    }),
  });
  const stored = new Map<string, Screen>(
    [...generateRegion(worldOf(seed + 1), OLD_BLOCK)].map(([key, s]) => [key, snowed(s)]),
  );
  const older: Older = (coord) => stored.get(screenKey(coord));
  const screens = new Map(stored);
  for (let sy = REGION.y0; sy < REGION.y0 + REGION.h; sy++) {
    for (let sx = REGION.x0; sx < REGION.x0 + REGION.w; sx++) {
      const coord = { layer: OVERWORLD, sx, sy };
      if (!stored.has(screenKey(coord)))
        screens.set(screenKey(coord), generateScreen(world, coord, older));
    }
  }
  return { world, stored, older, screens };
}

describe.each(SEEDS)('next to older screens, a world with seed %i', (seed) => {
  const { world, stored, older, screens } = mixedWorld(seed);
  const isNew = (s: Screen) => !stored.has(screenKey(s.coord));

  test('copies every lattice point it shares with them, and new screens still agree with each other', () => {
    expect(seamMismatches(screens)).toEqual([]);
  });

  test('dithers from their edge to its own fields over STITCH_REACH points, adding no water', () => {
    let differing = 0;
    let held = 0;
    for (const screen of [...screens.values()].filter(isNew)) {
      for (const dir of DIRS) {
        const neighbour = stored.get(screenKey(neighborCoord(screen.coord, dir)));
        if (!neighbour) continue;
        const { dx, dy } = DIR_DELTA[dir];
        const along = dx === 0 ? LATTICE_W : LATTICE_H;
        // Lattice x or y in this screen at `depth` points in from the seam with the neighbour.
        const inward = (depth: number) =>
          dx > 0 ? SCREEN_W - depth : dx < 0 ? depth : dy > 0 ? SCREEN_H - depth : depth;
        for (let i = 2; i < along - 2; i++) {
          const at = (depth: number): [number, number] =>
            dx === 0 ? [i, inward(depth)] : [inward(depth), i];
          const field = (depth: number) => {
            const [cx, cy] = at(depth);
            const gx = screen.coord.sx * SCREEN_W + cx;
            const gy = screen.coord.sy * SCREEN_H + cy;
            return fieldTerrain(world, OVERWORLD, gx, gy);
          };
          const [ex, ey] = at(0);
          const edge = cornerAt(neighbour, ex - dx * SCREEN_W, ey - dy * SCREEN_H);
          expect(cornerAt(screen, ...at(0))).toBe(edge);
          expect(cornerAt(screen, ...at(STITCH_REACH))).toBe(field(STITCH_REACH));
          const got = cornerAt(screen, ...at(1));
          if (got === 'water') expect(field(1)).toBe('water');
          if (edge === field(1)) continue;
          differing++;
          if (got === (edge === 'water' ? 'sand' : edge)) held++;
        }
      }
    }
    expect(differing).toBeGreaterThan(20);
    expect(held / differing).toBeGreaterThan(0.6);
  });

  test('keeps a road solid through the blend band, up to their edge', () => {
    const plan = networkOf(world, OVERWORLD).plan({
      x0: REGION.x0 * SCREEN_W,
      y0: REGION.y0 * SCREEN_H,
      x1: (REGION.x0 + REGION.w) * SCREEN_W,
      y1: (REGION.y0 + REGION.h) * SCREEN_H,
    });
    const oldX0 = OLD_BLOCK.x0 * SCREEN_W;
    const oldY0 = OLD_BLOCK.y0 * SCREEN_H;
    const oldX1 = (OLD_BLOCK.x0 + OLD_BLOCK.w) * SCREEN_W;
    const oldY1 = (OLD_BLOCK.y0 + OLD_BLOCK.h) * SCREEN_H;
    let banded = 0;
    const faded: string[] = [];
    for (const screen of [...screens.values()].filter(isNew)) {
      for (let cy = 0; cy < LATTICE_H; cy++) {
        for (let cx = 0; cx < LATTICE_W; cx++) {
          const gx = screen.coord.sx * SCREEN_W + cx;
          const gy = screen.coord.sy * SCREEN_H + cy;
          const d = Math.max(oldX0 - gx, gx - oldX1, oldY0 - gy, gy - oldY1);
          if (d < 1 || d >= STITCH_REACH || !plan.road(gx, gy)) continue;
          banded++;
          const t = cornerAt(screen, cx, cy);
          if (t !== 'path' && t !== 'sand') faded.push(`${gx},${gy} ${t}`);
        }
      }
    }
    expect(faded).toEqual([]);
    // In the first and third seeds' worlds no road passes the old block; in the others one does.
    if (seed !== SEEDS[0] && seed !== SEEDS[2]) expect(banded).toBeGreaterThan(0);
  });

  test('opens onto the whole walkable edge of their main land, so every screen is reached from the garden', () => {
    const reached = reachableScreens(world, screens);
    expect([...screens.keys()].filter((k) => !reached.has(k))).toEqual([]);
    const blocked: string[] = [];
    let openings = 0;
    for (const screen of [...screens.values()].filter(isNew)) {
      for (const dir of DIRS) {
        const other = stored.get(screenKey(neighborCoord(screen.coord, dir)));
        if (!other) continue;
        const walk = components((tx, ty) => isTileWalkable(other, tx, ty));
        const sizes = new Map<number, number>();
        for (const id of walk) if (id !== -1) sizes.set(id, (sizes.get(id) ?? 0) + 1);
        const main = [...sizes].sort((a, b) => b[1] - a[1])[0]![0];
        for (const tile of edgeTiles(dir)) {
          const [ox, oy] = facing(dir, tile);
          if (walk[oy * SCREEN_W + ox] !== main || !terrainWalkable(screen, ...tile)) continue;
          if (isTileWalkable(screen, ...tile)) openings++;
          else blocked.push(`${screenKey(screen.coord)} ${dir} ${tile.join(',')}`);
        }
      }
    }
    expect(blocked).toEqual([]);
    expect(openings).toBeGreaterThan(24);
  });

  test('joins every walkable pocket of a new screen to a crossing', () => {
    const stranded: string[] = [];
    for (const screen of [...screens.values()].filter(isNew)) {
      const walk = components((tx, ty) => isTileWalkable(screen, tx, ty));
      const reached = new Set(
        crossingTiles(world, screen.coord, older).map(([tx, ty]) => walk[ty * SCREEN_W + tx]),
      );
      for (const id of new Set(walk)) {
        if (id !== -1 && !reached.has(id)) stranded.push(`${screenKey(screen.coord)} ${id}`);
      }
    }
    expect(stranded).toEqual([]);
  });
});

describe('generateScreen', () => {
  test('is deterministic, and different seeds give different worlds', () => {
    const coord: ScreenCoord = { layer: OVERWORLD, sx: 3, sy: -2 };
    expect(generateScreen(worldOf(5), coord)).toEqual(generateScreen(worldOf(5), coord));
    const a = generateRegion(worldOf(5), { x0: 0, y0: 0, w: 4, h: 4 });
    const b = generateRegion(worldOf(6), { x0: 0, y0: 0, w: 4, h: 4 });
    const same = [...a].filter(
      ([key, screen]) => JSON.stringify(b.get(key)) === JSON.stringify(screen),
    );
    expect(same.map(([key]) => key)).toEqual([screenKey(GARDEN_COORD)]);
  });

  test('depends only on the seed, layer, and position', () => {
    const coord: ScreenCoord = { layer: OVERWORLD, sx: 3, sy: -2 };
    const cellar = generateScreen(worldOf(5), { ...coord, layer: 'cellar' as LayerId });
    expect(cellar.coord.layer).toBe('cellar');
    expect(cellar.corners).not.toEqual(generateScreen(worldOf(5), coord).corners);
    expect(generateScreen(worldOf(5), { ...GARDEN_COORD, layer: 'cellar' as LayerId })).not.toEqual(
      secretGarden(),
    );
  });

  test('has lakes, forests, and meadows that each span several screens', () => {
    const screens = [...generateRegion(worldOf(3), { x0: -12, y0: -12, w: 24, h: 24 }).values()];
    const water = (s: Screen) => s.corners.filter((t) => t === 'water').length;
    const trees = (s: Screen) => s.features.filter((f) => f === 'tree').length;
    const lakeScreens = screens.filter((s) => water(s) > 40);
    const forestScreens = screens.filter((s) => trees(s) > 80);
    const meadowScreens = screens.filter((s) => trees(s) < 10 && water(s) === 0);
    expect(lakeScreens.length).toBeGreaterThan(20);
    expect(forestScreens.length).toBeGreaterThan(30);
    expect(meadowScreens.length).toBeGreaterThan(60);
    expect(screens.some((s) => s.corners.includes('sand'))).toBe(true);
    expect(screens.some((s) => s.corners.includes('dirt'))).toBe(true);
  });

  test('generates a screen in under 10 ms', () => {
    const world = worldOf(11);
    const started = Date.now();
    const n = 200;
    for (let i = 0; i < n; i++) generateScreen(world, { layer: OVERWORLD, sx: i % 20, sy: 30 + i });
    expect((Date.now() - started) / n).toBeLessThan(10);
  });
});

describe('secret garden', () => {
  const world = worldOf(42);
  const garden = secretGarden();

  test('comes back unchanged from the generator', () => {
    expect(generateScreen(world, GARDEN_COORD)).toEqual(garden);
  });

  test('sits in a clearing whose neighbours match its seams and open onto its exits', () => {
    const around = generateRegion(world, { x0: -1, y0: -1, w: 3, h: 3 });
    expect(seamMismatches(generateRegion(world, { x0: -2, y0: -2, w: 5, h: 5 }))).toEqual([]);
    const ring = [...around].filter(([key]) => key !== screenKey(GARDEN_COORD)).map(([, s]) => s);
    expect(ring.every((s) => !s.corners.includes('water'))).toBe(true);
    for (const dir of DIRS) {
      const other = around.get(screenKey(neighborCoord(GARDEN_COORD, dir)))!;
      const exits = edgeTiles(dir).filter((t) => isTileWalkable(garden, ...t));
      expect(exits.length).toBeGreaterThan(0);
      for (const exit of exits) expect(isTileWalkable(other, ...facing(dir, exit))).toBe(true);
    }
  });

  test('connects all of its openings', () => {
    const comp = components((tx, ty) => isTileWalkable(garden, tx, ty));
    const exits = DIRS.flatMap((dir) => edgeTiles(dir).filter((t) => isTileWalkable(garden, ...t)));
    expect(new Set(exits.map(([tx, ty]) => comp[ty * SCREEN_W + tx])).size).toBe(1);
  });

  test('has a pond you cannot walk into', () => {
    expect(isTileWalkable(garden, 9, 7)).toBe(false);
  });
});
