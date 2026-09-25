import { SCREEN_H, SCREEN_W } from '@explore/core';
import { expect, test } from 'vitest';
import { screenRect } from './map-view.ts';

const zooms = [1, 1.25, 1.25 ** 2, 1.25 ** 5, 0.8 * 1.25 ** 9, 24];

test.each(zooms.flatMap((zoom) => [1, 1.5, 2].map((dpr) => zoom * dpr)))(
  'screens at device scale %d sit on whole pixels and meet their neighbours with no gap',
  (s) => {
    const ox = 613.37;
    const oy = -291.81;
    for (let sy = -6; sy <= 6; sy++) {
      for (let sx = -6; sx <= 6; sx++) {
        const r = screenRect(s, ox, oy, sx, sy);
        expect([r.x, r.y, r.w, r.h].every(Number.isInteger)).toBe(true);
        expect(Math.abs(r.w - SCREEN_W * s)).toBeLessThanOrEqual(1);
        expect(Math.abs(r.h - SCREEN_H * s)).toBeLessThanOrEqual(1);
        expect(screenRect(s, ox, oy, sx + 1, sy).x).toBe(r.x + r.w);
        expect(screenRect(s, ox, oy, sx, sy + 1).y).toBe(r.y + r.h);
      }
    }
  },
);
