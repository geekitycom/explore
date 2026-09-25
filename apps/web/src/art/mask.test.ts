import { TILE } from '@explore/core';
import { describe, expect, it } from 'vitest';
import { TUFTS, WAVES, cornerMask, edgeDistance, layerRegion, type Fringe } from './mask.ts';

const W = 9;
const H = 7;
const PX_W = (W - 1) * TILE;
const PX_H = (H - 1) * TILE;

const latticeOf = (at: (cx: number, cy: number) => number) =>
  Array.from({ length: W * H }, (_, i) => at(i % W, Math.floor(i / W)));

let seed = 1;
const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const randomLattices = Array.from({ length: 40 }, () => latticeOf(() => Math.floor(random() * 4)));

const fringeSets: Record<string, readonly Fringe[]> = {
  waves: [WAVES, WAVES, WAVES, WAVES],
  tufts: [TUFTS, TUFTS, TUFTS, TUFTS],
  mixed: [WAVES, WAVES, TUFTS, WAVES],
};

/** For each pixel column, the first row from the top that the region does not cover. */
const depths = (region: Uint8Array) =>
  Array.from({ length: PX_W }, (_, x) => {
    let y = 0;
    while (y < PX_H && region[y * PX_W + x]) y++;
    return y;
  });

describe('layerRegion', () => {
  it('covers the pixel at each corner of every tile exactly when that corner is in the layer', () => {
    for (const [name, fringes] of Object.entries(fringeSets))
      for (const lattice of randomLattices)
        for (let layer = 1; layer <= 3; layer++) {
          const region = layerRegion(lattice, W, H, layer, fringes);
          for (let cy = 0; cy < H; cy++)
            for (let cx = 0; cx < W; cx++) {
              const inside = lattice[cy * W + cx]! >= layer ? 1 : 0;
              for (const [x, y] of [
                [cx * TILE - 1, cy * TILE - 1],
                [cx * TILE, cy * TILE - 1],
                [cx * TILE - 1, cy * TILE],
                [cx * TILE, cy * TILE],
              ] as const) {
                if (x < 0 || y < 0 || x >= PX_W || y >= PX_H) continue;
                expect(region[y * PX_W + x], `${name} layer ${layer} at ${x},${y}`).toBe(inside);
              }
            }
        }
  });

  it('draws nothing in a tile whose corners are all below the layer', () => {
    for (const [name, fringes] of Object.entries(fringeSets))
      for (const lattice of randomLattices) {
        const region = layerRegion(lattice, W, H, 2, fringes);
        for (let ty = 0; ty < H - 1; ty++)
          for (let tx = 0; tx < W - 1; tx++) {
            const corners = [
              lattice[ty * W + tx]!,
              lattice[ty * W + tx + 1]!,
              lattice[(ty + 1) * W + tx]!,
              lattice[(ty + 1) * W + tx + 1]!,
            ] as const;
            if (cornerMask(corners, 2) !== 0) continue;
            for (let y = 0; y < TILE; y++)
              for (let x = 0; x < TILE; x++)
                expect(region[(ty * TILE + y) * PX_W + tx * TILE + x], name).toBe(0);
          }
      }
  });

  it('has no speckle: every pixel shares a side with a pixel of its own kind', () => {
    for (const [name, fringes] of Object.entries(fringeSets))
      for (const lattice of randomLattices) {
        const region = layerRegion(lattice, W, H, 2, fringes);
        for (let y = 1; y < PX_H - 1; y++)
          for (let x = 1; x < PX_W - 1; x++) {
            const v = region[y * PX_W + x];
            const same =
              region[y * PX_W + x - 1] === v ||
              region[y * PX_W + x + 1] === v ||
              region[(y - 1) * PX_W + x] === v ||
              region[(y + 1) * PX_W + x] === v;
            expect(same, `${name} at ${x},${y}`).toBe(true);
          }
      }
  });

  it('runs a diagonal coast as a straight line, one pixel per row, not in stairs', () => {
    for (const k of [9, 10]) {
      const lattice = latticeOf((cx, cy) => (cx + cy < k ? 1 : 0));
      const region = layerRegion(lattice, W, H, 1, fringeSets['waves']!);
      const ends = Array.from({ length: PX_H }, (_, y) => {
        let x = 0;
        while (x < PX_W && region[y * PX_W + x]) x++;
        return x;
      });
      for (let y = TILE; y < PX_H - TILE; y++) {
        const step = ends[y - 1]! - ends[y]!;
        expect(step, `row ${y} of coast ${k}`).toBeGreaterThanOrEqual(0);
        expect(step, `row ${y} of coast ${k}`).toBeLessThanOrEqual(2);
      }
    }
  });

  it('rounds a shallow slope instead of holding it flat for whole tiles', () => {
    const lattice = latticeOf((cx, cy) => (cy < 1.5 + cx / 3 ? 1 : 0));
    const inner = depths(layerRegion(lattice, W, H, 1, fringeSets['waves']!)).slice(TILE, -TILE);
    const jumps = inner.slice(1).map((d, i) => Math.abs(d - inner[i]!));
    expect(Math.max(...jumps)).toBeLessThanOrEqual(3);
  });

  it('tufts a straight grass edge but keeps a straight shore smooth', () => {
    const lattice = latticeOf((_, cy) => (cy <= 3 ? 1 : 0));
    const spread = (fringe: Fringe) => {
      const inner = depths(layerRegion(lattice, W, H, 1, [fringe, fringe])).slice(TILE, -TILE);
      return Math.max(...inner) - Math.min(...inner);
    };
    expect(spread(TUFTS)).toBeGreaterThanOrEqual(3);
    expect(spread(WAVES)).toBeLessThanOrEqual(2);
  });

  it('outlines an edge with the fringe of the terrain on its high side', () => {
    const lattice = latticeOf((_, cy) => (cy <= 3 ? 3 : 1));
    const fringes = fringeSets['mixed']!;
    expect(layerRegion(lattice, W, H, 2, fringes)).toEqual(layerRegion(lattice, W, H, 3, fringes));
  });

  it('draws the same pixels on both sides of a screen seam', () => {
    for (const [name, fringes] of Object.entries(fringeSets))
      for (let n = 0; n < 20; n++) {
        const left = randomLattices[n]!;
        const other = randomLattices[n + 20]!;
        const right = latticeOf((cx, cy) =>
          cx === 0 ? left[cy * W + W - 1]! : other[cy * W + cx]!,
        );
        const a = layerRegion(left, W, H, 1, fringes);
        const b = layerRegion(right, W, H, 1, fringes);
        const da = edgeDistance(a, PX_W, PX_H, 5);
        const db = edgeDistance(b, PX_W, PX_H, 5);
        for (let y = 0; y < PX_H; y++) {
          expect(a[y * PX_W + PX_W - 1], `${name} row ${y}`).toBe(b[y * PX_W]);
          expect(da[y * PX_W + PX_W - 1], `${name} row ${y}`).toBe(db[y * PX_W]);
        }
      }
  });
});

describe('cornerMask', () => {
  it('sets the corners at or above the layer, in NW, NE, SW, SE bit order', () => {
    const waterSandDirtGrass = [0, 1, 2, 3] as const;
    expect(cornerMask(waterSandDirtGrass, 1)).toBe(2 | 4 | 8);
    expect(cornerMask(waterSandDirtGrass, 2)).toBe(4 | 8);
    expect(cornerMask(waterSandDirtGrass, 3)).toBe(8);
    expect(cornerMask([3, 0, 0, 3], 2)).toBe(1 | 8);
    expect(cornerMask([1, 1, 1, 1], 2)).toBe(0);
    expect(cornerMask([0, 0, 0, 0], 0)).toBe(15);
  });
});

describe('edgeDistance', () => {
  const lattice = latticeOf((cx, cy) => (cx >= 3 && cx <= 5 && cy >= 2 && cy <= 4 ? 2 : 0));
  const region = layerRegion(lattice, W, H, 1, fringeSets['waves']!);

  it('measures inside as negative and outside as positive distance to the edge', () => {
    const distance = edgeDistance(region, PX_W, PX_H, 4);
    const centre = 3 * TILE * PX_W + 4 * TILE;
    expect(region[centre]).toBe(1);
    expect(distance[centre]).toBeLessThan(-4);
    expect(distance[PX_W + 1]).toBe(Infinity);
    for (let i = 0; i < region.length; i++) {
      if (!Number.isFinite(distance[i])) continue;
      expect(Math.sign(distance[i]!)).toBe(region[i] ? -1 : 1);
    }
    expect([...distance].filter((d) => Math.abs(d) === 1).length).toBeGreaterThan(0);
  });

  it('matches a direct search from every pixel, on random regions', () => {
    const reach = 5;
    const direct = (region: Uint8Array, x: number, y: number) => {
      const v = region[y * PX_W + x];
      const onRow = y === 0 || y === PX_H - 1;
      const onColumn = x === 0 || x === PX_W - 1;
      let best = Infinity;
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++) {
          if ((onColumn && dx !== 0) || (onRow && dy !== 0)) continue;
          const d = Math.hypot(dx, dy);
          if (d === 0 || d > reach || d >= best) continue;
          const nx = Math.min(PX_W - 1, Math.max(0, x + dx));
          const ny = Math.min(PX_H - 1, Math.max(0, y + dy));
          if (region[ny * PX_W + nx] !== v) best = d;
        }
      return Math.fround(v ? -best : best);
    };
    for (const lattice of randomLattices.slice(0, 10)) {
      const region = layerRegion(lattice, W, H, 2, fringeSets['mixed']!);
      const distance = edgeDistance(region, PX_W, PX_H, reach);
      const wrong = [];
      for (let y = 0; y < PX_H; y++)
        for (let x = 0; x < PX_W; x++)
          if (distance[y * PX_W + x] !== direct(region, x, y)) wrong.push(`${x},${y}`);
      expect(wrong).toEqual([]);
    }
  });
});
