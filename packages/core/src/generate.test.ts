import { describe, expect, test } from 'vitest';
import { GARDEN_COORD, secretGarden } from './garden.ts';
import { NEIGHBOR_OFFSETS, generateScreen, neighborsOf, type NeighborDir } from './generate.ts';
import { growWorld } from './testing.ts';
import { isTileWalkable } from './walk.ts';
import {
  LATTICE_H,
  LATTICE_W,
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  cornerAt,
  featureAt,
  screenKey,
  type LayerId,
  type Screen,
  type ScreenCoord,
} from './world.ts';

const WORLD_SEEDS = Array.from({ length: 12 }, (_, i) => 1000 + i * 7919);
const DISCOVERIES = 60;

function edgeTiles(screen: Screen): [number, number][] {
  const tiles: [number, number][] = [];
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const onEdge = tx === 0 || ty === 0 || tx === SCREEN_W - 1 || ty === SCREEN_H - 1;
      if (onEdge && isTileWalkable(screen, tx, ty)) tiles.push([tx, ty]);
    }
  }
  return tiles;
}

function reachableFrom(screen: Screen, [sx, sy]: [number, number]): Set<string> {
  const seen = new Set([`${sx},${sy}`]);
  const queue: [number, number][] = [[sx, sy]];
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [x, y] = next;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      const key = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= SCREEN_W || ny >= SCREEN_H || seen.has(key)) continue;
      if (!isTileWalkable(screen, nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

const isEdge = (x: number, y: number) =>
  x === 0 || y === 0 || x === SCREEN_W - 1 || y === SCREEN_H - 1;

/**
 * Walkable edge tiles cut off from the screen's main edge region. The only acceptable ones are
 * pockets walled in entirely by edge tiles, whose features are copied from neighbors and can't
 * be carved; a player can only reach such a pocket from the neighbor it borders.
 */
function trappedEdgeTiles(screen: Screen): [number, number][] {
  const tiles = edgeTiles(screen);
  if (tiles.length === 0) return [];
  const regions: Set<string>[] = [];
  for (const tile of tiles) {
    if (regions.some((r) => r.has(tile.join(',')))) continue;
    regions.push(reachableFrom(screen, tile));
  }
  regions.sort((a, b) => b.size - a.size);
  const walledByEdges = (region: Set<string>) =>
    [...region].every((key) => {
      const [x, y] = key.split(',').map(Number) as [number, number];
      return [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ].every(([nx, ny]) => {
        const inside = nx! >= 0 && ny! >= 0 && nx! < SCREEN_W && ny! < SCREEN_H;
        return !inside || region.has(`${nx},${ny}`) || isEdge(nx!, ny!);
      });
    });
  return regions
    .slice(1)
    .filter((r) => !walledByEdges(r))
    .flatMap((r) => [...r].map((k) => k.split(',').map(Number) as [number, number]));
}

describe.each(WORLD_SEEDS)('a world grown from seed %i', (seed) => {
  const { world, order } = growWorld(seed, DISCOVERIES);
  const generatedAt = new Map(order.map((key, i) => [key, i]));

  const pairs = [...world.values()].flatMap((screen) =>
    (Object.keys(NEIGHBOR_OFFSETS) as NeighborDir[]).flatMap((dir) => {
      const { dx, dy } = NEIGHBOR_OFFSETS[dir];
      const other = world.get(
        screenKey({ ...screen.coord, sx: screen.coord.sx + dx, sy: screen.coord.sy + dy }),
      );
      return other ? [{ screen, other, dir }] : [];
    }),
  );

  test('every shared lattice point agrees, across edges and diagonals', () => {
    const mismatches: string[] = [];
    for (const { screen, other, dir } of pairs) {
      const { dx, dy } = NEIGHBOR_OFFSETS[dir];
      for (let cy = 0; cy < LATTICE_H; cy++) {
        for (let cx = 0; cx < LATTICE_W; cx++) {
          const ox = cx - dx * SCREEN_W;
          const oy = cy - dy * SCREEN_H;
          if (ox < 0 || oy < 0 || ox >= LATTICE_W || oy >= LATTICE_H) continue;
          if (cornerAt(screen, cx, cy) !== cornerAt(other, ox, oy)) {
            mismatches.push(`${screenKey(screen.coord)} ${dir} (${cx},${cy})`);
          }
        }
      }
    }
    expect(pairs.length).toBeGreaterThan(DISCOVERIES);
    expect(mismatches).toEqual([]);
  });

  const edgePairs = pairs
    .filter(({ dir }) => dir.length === 1)
    .filter(
      ({ screen, other }) =>
        generatedAt.get(screenKey(screen.coord))! > generatedAt.get(screenKey(other.coord))!,
    );

  const acrossSeam = ({ screen, other, dir }: (typeof edgePairs)[number]) => {
    const { dx, dy } = NEIGHBOR_OFFSETS[dir];
    const tiles: { ours: [number, number]; theirs: [number, number] }[] = [];
    for (let i = 1; i < (dx === 0 ? SCREEN_W : SCREEN_H) - 1; i++) {
      const ours: [number, number] =
        dx === 0 ? [i, dy < 0 ? 0 : SCREEN_H - 1] : [dx < 0 ? 0 : SCREEN_W - 1, i];
      const theirs: [number, number] = [
        ours[0] - dx * (SCREEN_W - 1),
        ours[1] - dy * (SCREEN_H - 1),
      ];
      tiles.push({ ours, theirs });
    }
    return tiles.map((t) => ({ ...t, screen, other }));
  };

  test('edge features continue from the earlier neighbor (corner tiles excepted)', () => {
    const mismatches = edgePairs
      .flatMap(acrossSeam)
      .filter(
        ({ screen, other, ours, theirs }) =>
          featureAt(screen, ...ours) !== featureAt(other, ...theirs),
      );
    expect(mismatches).toEqual([]);
  });

  test('a walkable tile at an older edge faces a walkable tile across the seam', () => {
    const stuck = edgePairs
      .flatMap(acrossSeam)
      .filter(
        ({ screen, other, ours, theirs }) =>
          isTileWalkable(other, ...theirs) && !isTileWalkable(screen, ...ours),
      )
      .map(({ screen, ours }) => `${screenKey(screen.coord)} (${ours.join(',')})`);
    expect(stuck).toEqual([]);
  });

  test('all walkable edge tiles of every generated screen connect', () => {
    const trapped = [...world.values()]
      .filter((s) => trappedEdgeTiles(s).length > 0)
      .map((s) => screenKey(s.coord));
    expect(trapped).toEqual([]);
  });

  test('every generated screen can be entered from somewhere', () => {
    expect([...world.values()].filter((s) => edgeTiles(s).length === 0)).toEqual([]);
  });
});

describe('generateScreen', () => {
  const garden = secretGarden();
  const lookup = (c: ScreenCoord) =>
    screenKey(c) === screenKey(GARDEN_COORD) ? garden : undefined;

  test('is deterministic for a seed and neighborhood', () => {
    const coord = { layer: OVERWORLD, sx: 1, sy: 0 };
    const a = generateScreen(coord, 77, neighborsOf(coord, lookup));
    const b = generateScreen(coord, 77, neighborsOf(coord, lookup));
    const c = generateScreen(coord, 78, neighborsOf(coord, lookup));
    expect(b).toEqual(a);
    expect(c.features).not.toEqual(a.features);
  });

  test('finds neighbors only on the same layer', () => {
    expect(neighborsOf({ layer: OVERWORLD, sx: 1, sy: 0 }, lookup)).toEqual({ w: garden });
    expect(neighborsOf({ layer: 'cellar' as LayerId, sx: 1, sy: 0 }, lookup)).toEqual({});
  });

  test('produces varied screens', () => {
    const screens = Array.from({ length: 40 }, (_, seed) =>
      generateScreen({ layer: OVERWORLD, sx: 5, sy: 5 }, seed, {}),
    );
    const share = (pred: (s: Screen) => boolean) => screens.filter(pred).length / screens.length;
    expect(share((s) => s.corners.includes('water'))).toBeGreaterThan(0.15);
    expect(share((s) => s.features.filter((f) => f === 'tree').length > 20)).toBeGreaterThan(0.15);
    expect(share((s) => s.features.filter((f) => f === 'tree').length < 5)).toBeGreaterThan(0.15);
  });
});

describe('secret garden', () => {
  const garden = secretGarden();

  test('has a walkable opening on every side', () => {
    const open = (tiles: [number, number][]) =>
      tiles.some(([x, y]) => isTileWalkable(garden, x, y));
    const row = (y: number) => Array.from({ length: SCREEN_W }, (_, x): [number, number] => [x, y]);
    const col = (x: number) => Array.from({ length: SCREEN_H }, (_, y): [number, number] => [x, y]);
    expect([open(row(0)), open(row(SCREEN_H - 1)), open(col(0)), open(col(SCREEN_W - 1))]).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  test('connects all of its openings', () => {
    expect(trappedEdgeTiles(garden)).toEqual([]);
    expect(new Set(edgeTiles(garden).map((t) => reachableFrom(garden, t).size)).size).toBe(1);
  });

  test('has a pond you cannot walk into', () => {
    expect(isTileWalkable(garden, 9, 7)).toBe(false);
  });
});
