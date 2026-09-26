import { SCREEN_H, SCREEN_W } from '@explore/core';
import { describe, expect, test } from 'vitest';
import type { WorldMap } from '../api.ts';
import { mapLabels, screenRect, type MapLabel } from './map-view.ts';

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

describe('map labels', () => {
  const layer = 'overworld';
  const at = (sx: number, sy: number) => ({ layer, sx, sy });
  const named = (sx: number, sy: number, ty: number, name: string) => ({
    x: (sx + 0.5) * SCREEN_W,
    y: sy * SCREEN_H + ty,
    name,
  });
  const cases: [string, Pick<WorldMap, 'you' | 'garden' | 'names'>][] = [
    ['the player in the garden', { you: at(0, 0), garden: at(0, 0), names: [] }],
    ...[1, 4, 8, 14].map((ty): [string, Pick<WorldMap, 'you' | 'garden' | 'names'>] => [
      `the player on a landmark's screen, signpost on row ${ty}`,
      { you: at(2, 1), garden: at(0, 0), names: [named(2, 1, ty, 'Hare Stones')] },
    ]),
    [
      'adjacent named screens',
      {
        you: at(-3, 2),
        garden: at(0, 0),
        names: [
          named(3, 0, 2, 'The Weeping Mere'),
          named(4, 0, 2, 'Old Crow Hollow'),
          named(3, 1, 1, 'Saltmarsh Graves'),
          named(1, 0, 1, 'Hare Stones'),
        ],
      },
    ],
  ];
  const measure = (text: string, size: number) => text.length * size * 0.6;
  const overlap = (a: MapLabel, b: MapLabel) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  describe.each(cases)('with %s', (_, data) => {
    test.each(zooms.flatMap((zoom) => [1, 2].map((dpr) => [zoom, dpr])))(
      'at zoom %d and pixel ratio %d, no two labels overlap',
      (zoom, dpr) => {
        const s = zoom * dpr;
        const ox = 613.37;
        const oy = 291.81;
        const labels = mapLabels(data, s, ox, oy, dpr, measure);
        expect(labels).toHaveLength(2 + data.names.length);
        for (const l of labels) expect([l.x, l.y, l.w, l.h].every(Number.isInteger)).toBe(true);
        const clashes = labels.flatMap((a, i) =>
          labels.slice(i + 1).flatMap((b) => (overlap(a, b) ? [`${a.text} / ${b.text}`] : [])),
        );
        expect(clashes).toEqual([]);

        const you = labels.find((l) => l.text === 'You')!;
        const screen = screenRect(s, ox, oy, data.you.sx, data.you.sy);
        expect(you.y + you.h).toBeLessThanOrEqual(screen.y);
        expect(you.y + you.h).toBeGreaterThan(screen.y - 10 * dpr);
      },
    );
  });
});
