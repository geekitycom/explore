import { describe, expect, test } from 'vitest';
import { secretGarden } from './garden.ts';
import { bare, type Tile } from './place.ts';
import { generateRegion, uniformScreen, withCorners, withFeatures, worldOf } from './testing.ts';
import {
  canOccupy,
  centreTile,
  facedTile,
  inReach,
  isTileWalkable,
  isWalkable,
  overlapsBox,
  wayIfSolid,
} from './walk.ts';
import {
  DIRS,
  DIR_DELTA,
  SCREEN_H,
  SCREEN_W,
  TILE,
  inScreen,
  tileIndex,
  type Feature,
  type Pose,
} from './world.ts';

describe('isTileWalkable', () => {
  test('blocking features block, decorative ones do not', () => {
    const s = withFeatures(uniformScreen(), [
      [1, 1, 'tree'],
      [2, 1, 'bush'],
      [3, 1, 'rock'],
      [4, 1, 'flowers'],
      [5, 1, 'tallgrass'],
      [6, 1, 'bones'],
    ]);
    expect([1, 2, 3, 4, 5, 6].map((tx) => isTileWalkable(s, tx, 1))).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
    ]);
  });

  test('a tile is water-blocked only with 3 or 4 water corners', () => {
    const two = withCorners(uniformScreen(), [
      [5, 5, 'water'],
      [6, 5, 'water'],
    ]);
    const three = withCorners(two, [[5, 6, 'water']]);
    expect(isTileWalkable(two, 5, 5)).toBe(true);
    expect(isTileWalkable(three, 5, 5)).toBe(false);
    expect(isTileWalkable(uniformScreen('water'), 0, 0)).toBe(false);
  });
});

describe('canOccupy', () => {
  const s = withFeatures(uniformScreen(), [[5, 5, 'rock']]);

  test('feet overlapping a blocked tile cannot stand there', () => {
    expect(canOccupy(bare(s), 5 * 16 + 8, 5 * 16 + 8)).toBe(false);
    expect(canOccupy(bare(s), 5 * 16 - 5, 5 * 16 + 8)).toBe(true);
    expect(canOccupy(bare(s), 5 * 16 - 4, 5 * 16 + 8)).toBe(false);
  });

  test('the body may overlap the tile above the feet', () => {
    expect(canOccupy(bare(s), 5 * 16 + 8, 6 * 16 + 4)).toBe(true);
    expect(canOccupy(bare(s), 5 * 16 + 8, 6 * 16 + 3)).toBe(false);
  });

  test('past the screen edge counts as open', () => {
    expect(canOccupy(bare(uniformScreen('water')), -10, -10)).toBe(true);
    expect(canOccupy(bare(uniformScreen('water')), 1, 100)).toBe(false);
  });
});

describe('isWalkable', () => {
  test('a place with no traces walks exactly like the generated screen', () => {
    for (const screen of generateRegion(worldOf(3), { x0: 0, y0: 0, w: 2, h: 2 }).values()) {
      const place = bare(screen);
      for (let ty = 0; ty < SCREEN_H; ty++) {
        for (let tx = 0; tx < SCREEN_W; tx++) {
          expect(isWalkable(place, tx, ty)).toBe(isTileWalkable(screen, tx, ty));
        }
      }
    }
  });

  test('every walkable tile of the garden reaches the screen border', () => {
    const place = bare(secretGarden());
    const border = (tx: number, ty: number) =>
      tx === 0 || ty === 0 || tx === SCREEN_W - 1 || ty === SCREEN_H - 1;
    const seen = new Set<number>();
    const stack: [number, number][] = [];
    for (let ty = 0; ty < SCREEN_H; ty++) {
      for (let tx = 0; tx < SCREEN_W; tx++) {
        if (border(tx, ty) && isWalkable(place, tx, ty)) {
          seen.add(tileIndex(tx, ty));
          stack.push([tx, ty]);
        }
      }
    }
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      for (const { dx, dy } of Object.values(DIR_DELTA)) {
        const [nx, ny] = [x + dx, y + dy];
        if (!isWalkable(place, nx, ny) || seen.has(tileIndex(nx, ny))) continue;
        seen.add(tileIndex(nx, ny));
        stack.push([nx, ny]);
      }
    }
    const stranded: string[] = [];
    for (let ty = 0; ty < SCREEN_H; ty++) {
      for (let tx = 0; tx < SCREEN_W; tx++) {
        if (isWalkable(place, tx, ty) && !seen.has(tileIndex(tx, ty))) stranded.push(`${tx},${ty}`);
      }
    }
    expect(stranded, 'walkable garden tiles with no way to the border').toEqual([]);
  });
});

const pose = (x: number, y: number, dir: Pose['dir'] = 's'): Pose => ({ x, y, dir, moving: false });

describe('facedTile', () => {
  const [tx0, ty0] = [10, 7];
  const positions: [number, number][] = [];
  for (let dy = 0; dy < TILE; dy += 0.5) {
    for (let dx = 0; dx < TILE; dx += 0.5) positions.push([tx0 * TILE + dx, ty0 * TILE + dy]);
  }

  test('is the centre tile plus one step, for every sub-pixel position and facing', () => {
    for (const [x, y] of positions) {
      for (const dir of DIRS) {
        const centre = centreTile(pose(x, y, dir));
        const faced = facedTile(pose(x, y, dir));
        expect(faced, `(${x}, ${y}) facing ${dir} has no faced tile`).toBeDefined();
        expect(faced).toEqual({
          tx: centre.tx + DIR_DELTA[dir].dx,
          ty: centre.ty + DIR_DELTA[dir].dy,
        });
        expect(inScreen(faced!.tx, faced!.ty)).toBe(true);
      }
    }
  });

  test('the centre tile holds the middle of the feet box, 1.5 px above the feet', () => {
    expect(centreTile(pose(168, 113.5))).toEqual({ tx: 10, ty: 7 });
    expect(centreTile(pose(168, 113.4))).toEqual({ tx: 10, ty: 6 });
  });

  test('facing south with the feet near the bottom of a tile faces the tile below, not the one stood on', () => {
    for (const [x, y] of positions.filter(([, y]) => y % TILE >= TILE - 4)) {
      const feet = { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
      expect(facedTile(pose(x, y, 's'))).toEqual({ tx: feet.tx, ty: feet.ty + 1 });
    }
  });

  test('facing south faces the tile stood on only in the top 1.5 px of a tile', () => {
    for (const [x, y] of positions) {
      const feet = { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
      expect(facedTile(pose(x, y, 's'))!.ty === feet.ty).toBe(y % TILE < 1.5);
    }
  });

  test('is undefined past the screen edge', () => {
    expect(facedTile(pose(8, 100, 'w'))).toBeUndefined();
    expect(facedTile(pose(100, 5, 'n'))).toBeUndefined();
    expect(facedTile(pose(8, 100, 'e'))).toEqual({ tx: 1, ty: 6 });
  });
});

describe('overlapsBox', () => {
  const tile: Tile = { tx: 10, ty: 7 };

  test('counts a tile the feet box reaches into by any amount, at each of its four edges', () => {
    expect(overlapsBox(tile, pose(155, 120))).toBe(false);
    expect(overlapsBox(tile, pose(155.5, 120))).toBe(true);
    expect(overlapsBox(tile, pose(180.5, 120))).toBe(true);
    expect(overlapsBox(tile, pose(181, 120))).toBe(false);
    expect(overlapsBox(tile, pose(168, 111))).toBe(false);
    expect(overlapsBox(tile, pose(168, 111.5))).toBe(true);
    expect(overlapsBox(tile, pose(168, 131.5))).toBe(true);
    expect(overlapsBox(tile, pose(168, 132))).toBe(false);
  });

  test('agrees with canOccupy: a pose overlaps exactly the tiles whose blocking it would feel', () => {
    for (const [x, y] of [
      [155.5, 120],
      [168, 131.5],
      [180.5, 111.5],
    ] as const) {
      const blocked = bare(withFeatures(uniformScreen(), [[tile.tx, tile.ty, 'rock']]));
      expect(canOccupy(blocked, x, y)).toBe(!overlapsBox(tile, pose(x, y)));
    }
  });
});

describe('inReach', () => {
  test('reaches the ring of tiles around the centre tile and nothing further', () => {
    const me = pose(168, 122);
    expect(centreTile(me)).toEqual({ tx: 10, ty: 7 });
    for (let ty = 4; ty <= 10; ty++) {
      for (let tx = 7; tx <= 13; tx++) {
        const near = Math.abs(tx - 10) <= 1 && Math.abs(ty - 7) <= 1;
        expect(inReach(me, { tx, ty }), `${tx},${ty}`).toBe(near);
      }
    }
  });
});

describe('wayIfSolid', () => {
  const trees = (tiles: [number, number][]): [number, number, Feature][] =>
    tiles.map(([tx, ty]) => [tx, ty, 'tree']);
  const row = (ty: number) =>
    Array.from({ length: SCREEN_W }, (_, tx): [number, number] => [tx, ty]);

  test('refuses every border tile, even on open ground', () => {
    const place = bare(uniformScreen());
    expect(wayIfSolid(place, { tx: 0, ty: 5 })).toBe('edge');
    expect(wayIfSolid(place, { tx: SCREEN_W - 1, ty: 5 })).toBe('edge');
    expect(wayIfSolid(place, { tx: 5, ty: 0 })).toBe('edge');
    expect(wayIfSolid(place, { tx: 5, ty: SCREEN_H - 1 })).toBe('edge');
  });

  test('a tile in a one-wide corridor splits it', () => {
    const corridor = bare(withFeatures(uniformScreen(), trees([...row(6), ...row(8)])));
    expect(wayIfSolid(corridor, { tx: 10, ty: 7 })).toBe('splits');
  });

  test('a tile on open ground, or whose neighbours meet around it, is open', () => {
    expect(wayIfSolid(bare(uniformScreen()), { tx: 10, ty: 7 })).toBe('open');
    const diagonals = trees([
      [9, 6],
      [11, 6],
      [9, 8],
      [11, 8],
    ]);
    expect(wayIfSolid(bare(withFeatures(uniformScreen(), diagonals)), { tx: 10, ty: 7 })).toBe(
      'open',
    );
  });

  test('the end of a dead end, with one walkable neighbour, is open', () => {
    const pocket = trees([
      [9, 7],
      [11, 7],
      [10, 6],
    ]);
    expect(wayIfSolid(bare(withFeatures(uniformScreen(), pocket)), { tx: 10, ty: 7 })).toBe('open');
  });
});
