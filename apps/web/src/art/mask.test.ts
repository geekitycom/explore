import { TILE } from '@explore/core';
import { describe, expect, it } from 'vitest';
import { CORNER_BITS, OVERLAY_MASKS, cornerMask, edgeDistance, layerRegion } from './mask.ts';

const at = (mask: number, x: number, y: number) => OVERLAY_MASKS[mask]![y * TILE + x];
const column = (mask: number, x: number) => Array.from({ length: TILE }, (_, y) => at(mask, x, y));
const row = (mask: number, y: number) => Array.from({ length: TILE }, (_, x) => at(mask, x, y));
const has = (mask: number, bit: number) => (mask & bit) !== 0;
const masks = [...Array(16).keys()];

describe('overlay masks', () => {
  it('draws nothing for mask 0 and a full tile for mask 15', () => {
    expect(OVERLAY_MASKS[0]!.every((v) => v === 0)).toBe(true);
    expect(OVERLAY_MASKS[15]!.every((v) => v === 1)).toBe(true);
  });

  it('covers each corner pixel exactly when that corner is set', () => {
    for (const mask of masks) {
      expect(at(mask, 0, 0)).toBe(has(mask, CORNER_BITS.nw) ? 1 : 0);
      expect(at(mask, TILE - 1, 0)).toBe(has(mask, CORNER_BITS.ne) ? 1 : 0);
      expect(at(mask, 0, TILE - 1)).toBe(has(mask, CORNER_BITS.sw) ? 1 : 0);
      expect(at(mask, TILE - 1, TILE - 1)).toBe(has(mask, CORNER_BITS.se) ? 1 : 0);
    }
  });

  it('agrees with every horizontal neighbour along the shared border', () => {
    for (const left of masks)
      for (const right of masks) {
        if (has(left, CORNER_BITS.ne) !== has(right, CORNER_BITS.nw)) continue;
        if (has(left, CORNER_BITS.se) !== has(right, CORNER_BITS.sw)) continue;
        expect(column(left, TILE - 1), `${left} beside ${right}`).toEqual(column(right, 0));
      }
  });

  it('agrees with every vertical neighbour along the shared border', () => {
    for (const top of masks)
      for (const bottom of masks) {
        if (has(top, CORNER_BITS.sw) !== has(bottom, CORNER_BITS.nw)) continue;
        if (has(top, CORNER_BITS.se) !== has(bottom, CORNER_BITS.ne)) continue;
        expect(row(top, TILE - 1), `${top} above ${bottom}`).toEqual(row(bottom, 0));
      }
  });

  it('crosses each mixed tile side at its middle', () => {
    for (const mask of masks) {
      if (has(mask, CORNER_BITS.nw) === has(mask, CORNER_BITS.ne)) continue;
      const top = row(mask, 0);
      const flips = top.findIndex((v, x) => x > 0 && v !== top[x - 1]);
      expect(Math.abs(flips - TILE / 2), `mask ${mask}`).toBeLessThanOrEqual(1);
    }
  });

  it('has no speckle: every pixel shares a side with a pixel of its own kind', () => {
    const clamp = (v: number) => Math.min(TILE - 1, Math.max(0, v));
    for (const mask of masks)
      for (let y = 0; y < TILE; y++)
        for (let x = 0; x < TILE; x++) {
          const v = at(mask, x, y);
          const same = [
            [x - 1, y],
            [x + 1, y],
            [x, y - 1],
            [x, y + 1],
          ].some(([nx, ny]) => {
            if (nx! < 0 || ny! < 0 || nx! >= TILE || ny! >= TILE)
              return at(mask, clamp(nx!), clamp(ny!)) === v;
            return at(mask, nx!, ny!) === v;
          });
          expect(same, `mask ${mask} at ${x},${y}`).toBe(true);
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

describe('layerRegion and edgeDistance', () => {
  const lattice = [
    [0, 0, 0],
    [0, 2, 0],
    [0, 0, 0],
  ].flat();
  const w = 2 * TILE;
  const region = layerRegion(lattice, 3, 3, 1);

  it('stamps each tile with the overlay for its corners', () => {
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        expect(region[y * w + x]).toBe(at(8, x, y));
        expect(region[y * w + TILE + x]).toBe(at(4, x, y));
        expect(region[(TILE + y) * w + x]).toBe(at(2, x, y));
        expect(region[(TILE + y) * w + TILE + x]).toBe(at(1, x, y));
      }
  });

  it('measures inside as negative and outside as positive distance to the edge', () => {
    const distance = edgeDistance(region, w, w, 4);
    const centre = TILE * w + TILE;
    expect(region[centre]).toBe(1);
    expect(distance[centre]).toBeLessThan(-4);
    expect(distance[0]).toBe(Infinity);
    for (let i = 0; i < region.length; i++) {
      if (!Number.isFinite(distance[i])) continue;
      expect(Math.sign(distance[i]!)).toBe(region[i] ? -1 : 1);
    }
    const boundary = [...distance].filter((d) => Math.abs(d) === 1).length;
    expect(boundary).toBeGreaterThan(0);
  });
});
