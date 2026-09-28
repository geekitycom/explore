import { SCREEN_H, SCREEN_W } from '@explore/core';
import { describe, expect, test } from 'vitest';
import type { MapPlayer, WorldMap } from '../api.ts';
import { mapLabels, mapLayout, screenRect, type MapLabel } from './map-view.ts';

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

describe('the map view', () => {
  const you = { layer: 'overworld', sx: 7, sy: -4 };
  const world = (count: number): WorldMap => ({
    layer: 'overworld',
    you,
    garden: { layer: 'overworld', sx: 0, sy: 0 },
    names: [],
    players: [],
    screens: Array.from({ length: count }, (_, i) => ({ sx: i % 25, sy: Math.floor(i / 25) })),
  });
  const canvases = [
    [640, 480],
    [1280, 720],
    [1917, 1033],
    [375, 667],
  ];
  const ratios = [1, 1.25, 1.5, 2, 3];

  test.each(ratios)(
    'centres your screen at pixel ratio %d on whole pixels, same size for 2 or 500 screens',
    (dpr) => {
      for (const [w, h] of canvases) {
        const [few, many] = [world(2), world(500)].map((data) => {
          const { s, ox, oy } = mapLayout(data.you, dpr, w!, h!);
          expect([s, ox, oy].every(Number.isInteger)).toBe(true);
          return screenRect(s, ox, oy, you.sx, you.sy);
        });
        expect(many).toEqual(few);
        expect(Math.abs(few!.x + few!.w / 2 - w! / 2)).toBeLessThanOrEqual(1);
        expect(Math.abs(few!.y + few!.h / 2 - h! / 2)).toBeLessThanOrEqual(1);
        expect(few!.w).toBe(SCREEN_W * Math.round(6 * dpr));
      }
    },
  );
});

describe('map labels', () => {
  const layer = 'overworld';
  const garden = { layer, sx: 0, sy: 0 };
  const named = (sx: number, sy: number, ty: number, name: string) => ({
    x: (sx + 0.5) * SCREEN_W,
    y: sy * SCREEN_H + ty,
    name,
  });
  type Data = Pick<WorldMap, 'garden' | 'names' | 'players'>;
  const standing = (
    id: number,
    sx: number,
    sy: number,
    name: string,
    shirt: MapPlayer['shirt'] = 'green',
  ): MapPlayer => ({
    id,
    name,
    x: (sx + 0.5) * SCREEN_W,
    y: (sy + 0.6) * SCREEN_H,
    shirt,
  });
  const cases: [string, Data][] = [
    ['the host alone in the garden', { garden, names: [], players: [standing(1, 0, 0, 'Ann')] }],
    ...[1, 4, 8, 14].map((ty): [string, Data] => [
      `the host on a landmark's screen, signpost on row ${ty}`,
      { garden, names: [named(2, 1, ty, 'Hare Stones')], players: [standing(1, 2, 1, 'Ann')] },
    ]),
    [
      'adjacent named screens',
      {
        garden,
        names: [
          named(3, 0, 2, 'The Weeping Mere'),
          named(4, 0, 2, 'Old Crow Hollow'),
          named(3, 1, 1, 'Saltmarsh Graves'),
          named(1, 0, 1, 'Hare Stones'),
        ],
        players: [standing(1, -3, 2, 'Ann')],
      },
    ],
    [
      'the host and two visitors crowding the garden and a named screen',
      {
        garden,
        names: [named(1, 0, 3, 'Hare Stones')],
        players: [
          standing(1, 0, 0, 'Ann'),
          standing(2, 0, 0, 'Benjamin the Bold', 'charcoal'),
          standing(3, 1, 0, 'Cat', 'white'),
        ],
      },
    ],
    [
      'a layer without the garden',
      { garden: null, names: [named(0, 0, 3, 'Hare Stones')], players: [standing(1, 0, 0, 'Ann')] },
    ],
  ];
  const measure = (text: string, size: number) => text.length * size * 0.6;
  type Box = Pick<MapLabel, 'x' | 'y' | 'w' | 'h'>;
  const overlap = (a: Box, b: Box) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  describe.each(cases)('with %s', (_, data) => {
    test.each(zooms.flatMap((zoom) => [1, 2].map((dpr) => [zoom, dpr])))(
      'at zoom %d and pixel ratio %d, every player is named, then the garden and landmarks, covering no label, dot, or marker',
      (zoom, dpr) => {
        const s = zoom * dpr;
        const ox = 613.37;
        const oy = 291.81;
        const labels = mapLabels(data, s, ox, oy, dpr, measure);
        expect(labels.map((l) => l.text)).toEqual([
          ...data.players.map((p) => p.name),
          ...(data.garden ? ['Secret Garden'] : []),
          ...data.names.map((n) => n.name),
        ]);
        for (const l of labels) expect([l.x, l.y, l.w, l.h].every(Number.isInteger)).toBe(true);
        const clashes = labels.flatMap((a, i) =>
          labels.slice(i + 1).flatMap((b) => (overlap(a, b) ? [`${a.text} / ${b.text}`] : [])),
        );
        expect(clashes).toEqual([]);

        const box = (x: number, y: number, size: number, what: string) => ({
          what,
          x: ox + x * s - (size / 2) * dpr,
          y: oy + y * s - (size / 2) * dpr,
          w: size * dpr,
          h: size * dpr,
        });
        const marks = [
          ...data.players.map((p) => box(p.x, p.y, 8, `${p.name}'s dot`)),
          ...(data.garden ? [box(10.5, 7.5, 5, 'the garden marker')] : []),
          ...data.names.map((n) => box(n.x, n.y, 5, `the ${n.name} marker`)),
        ];
        const covered = labels.flatMap((l) =>
          marks.flatMap((m) => (overlap(l, m) ? [`${l.text} over ${m.what}`] : [])),
        );
        expect(covered).toEqual([]);
      },
    );
  });

  test('names a player just below their dot when another player takes the spot above', () => {
    const dpr = 2;
    const at = (id: number, y: number, name: string): MapPlayer => ({
      id,
      name,
      x: 5,
      y,
      shirt: 'green',
    });
    const [ann, ben] = mapLabels(
      { garden: null, names: [], players: [at(1, 5, 'Ann'), at(2, 6.2, 'Ben')] },
      12,
      0,
      0,
      dpr,
      measure,
    );
    expect(ann!.y + ann!.h).toBeLessThanOrEqual(5 * 12);
    const dotBottom = 6.2 * 12 + 4 * dpr;
    expect(ben!.y).toBeGreaterThanOrEqual(dotBottom);
    expect(ben!.y).toBeLessThan(dotBottom + 12);
    expect(Math.abs(ben!.x + ben!.w / 2 - 5 * 12)).toBeLessThanOrEqual(1);
  });

  test('labels the garden like a landmark, just above its centre tile', () => {
    const dpr = 2;
    const [, gardenLabel, landmark] = mapLabels(
      { garden, names: [named(3, 2, 4, 'Hare Stones')], players: [standing(1, -2, 0, 'Ann')] },
      12,
      0,
      0,
      dpr,
      measure,
    );
    expect(gardenLabel).toMatchObject({ text: 'Secret Garden' });
    expect(landmark).toMatchObject({ text: 'Hare Stones' });
    expect({ color: gardenLabel!.color, size: gardenLabel!.size }).toEqual({
      color: landmark!.color,
      size: landmark!.size,
    });
    const centre = { x: 10.5 * 12, y: 7.5 * 12 };
    expect(Math.abs(gardenLabel!.x + gardenLabel!.w / 2 - centre.x)).toBeLessThanOrEqual(1);
    expect(gardenLabel!.y + gardenLabel!.h).toBeLessThanOrEqual(centre.y);
    expect(gardenLabel!.y + gardenLabel!.h).toBeGreaterThan(centre.y - 10 * dpr);
  });
});
