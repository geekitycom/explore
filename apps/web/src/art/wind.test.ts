import { SCREEN_PX_W } from '@explore/core';
import { describe, expect, test } from 'vitest';
import { bandOffset, gust, swaySlices } from './wind.ts';

describe('gust', () => {
  test('is continuous across a seam', () => {
    for (const clock of [0, 1.3, 7.9]) {
      const leftEdge = gust({ sx: 0, sy: 0 }, SCREEN_PX_W - 1, clock);
      const rightStart = gust({ sx: 1, sy: 0 }, 0, clock);
      expect(Math.abs(leftEdge - rightStart)).toBeLessThan(0.1);
    }
  });

  test('comes and goes over time', () => {
    const samples = Array.from({ length: 200 }, (_, i) => gust({ sx: 0, sy: 0 }, 100, i / 20));
    expect(Math.max(...samples)).toBeGreaterThan(0.8);
    expect(samples.filter((g) => Math.abs(g) < 0.5).length).toBeGreaterThan(40);
  });
});

describe('swaySlices', () => {
  test('keeps the still rows fixed and covers the whole sprite', () => {
    for (const lean of [-0.3, 0, 0.6, 1]) {
      const slices = swaySlices(32, { still: 8, bands: 2 }, lean);
      expect(slices.reduce((n, s) => n + s.h, 0)).toBe(32);
      expect(slices.at(-1)).toEqual({ y: 24, h: 8, dx: 0 });
      expect(slices.every((s) => [-1, 0, 1].includes(s.dx))).toBe(true);
    }
  });

  test('upper bands lean at least as far as lower ones', () => {
    const [top, lower] = swaySlices(32, { still: 8, bands: 2 }, 0.8);
    expect(top!.dx).toBe(1);
    expect(lower!.dx).toBeLessThanOrEqual(top!.dx);
  });

  test('never moves more than one pixel', () => {
    expect(bandOffset(1, 3, 3)).toBe(1);
    expect(bandOffset(-1, 3, 3)).toBe(-1);
    expect(bandOffset(0.2, 1, 3)).toBe(0);
  });
});
