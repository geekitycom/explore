import { describe, expect, test } from 'vitest';
import { generateScreen, networkOf } from '../../generate.ts';
import { landmarkAround } from '../../landmarks.ts';
import { placeOf, withChanges, type Place } from '../../place.ts';
import { uniformScreen, withFeatures, worldOf } from '../../testing.ts';
import { OVERWORLD, SCREEN_H, SCREEN_W, featureAt, type Pose, type Screen } from '../../world.ts';
import { bubblesAt } from '../act.ts';
import { DAY_MS } from '../fields.ts';
import { EMPTY_INVENTORY } from '../inventory.ts';
import type { Trace } from '../registry.ts';
import { EPITAPH_MAX, epitaph, seedEpitaph } from './epitaph.ts';

const GRAVES: [number, number][] = [
  [11, 7],
  [13, 7],
  [11, 9],
];
const screen = withFeatures(
  uniformScreen(),
  GRAVES.map(([tx, ty]) => [tx, ty, 'grave']),
);
const world = worldOf(42);
const settled = (place: Place, w = world) => withChanges(place, epitaph.settle!(place, w));
const epitaphs = (place: Place) => [...place.traces.values()].filter((t) => t.kind === 'epitaph');

describe('settling epitaphs', () => {
  test('puts a pending seed epitaph on every grave and nowhere else', () => {
    const place = settled(placeOf(screen, []));
    expect(epitaphs(place).map(({ tx, ty }) => [tx, ty])).toEqual(
      expect.arrayContaining(GRAVES) as unknown,
    );
    expect(epitaphs(place)).toHaveLength(GRAVES.length);
    for (const trace of epitaphs(place)) {
      expect(trace).toMatchObject({
        source: 'pending',
        text: seedEpitaph(world, screen.coord, trace),
      });
    }
  });

  test('leaves a grave that already has words alone, so reopening a screen changes nothing', () => {
    const written: Trace = {
      kind: 'epitaph',
      tx: 11,
      ty: 7,
      text: 'Gone fishing',
      source: 'model',
    };
    const place = settled(placeOf(screen, [written]));
    expect(epitaph.settle!(place, world)).toEqual([]);
    expect(epitaphs(place)).toContainEqual(written);
  });

  test('gives the same words for the same world, and other words in another world', () => {
    const words = (seed: number) =>
      epitaphs(settled(placeOf(screen, []), worldOf(seed))).map((t) =>
        t.kind === 'epitaph' ? t.text : '',
      );
    expect(words(42)).toEqual(words(42));
    expect(words(42)).not.toEqual(words(43));
    for (const text of words(42)) expect(text.length).toBeLessThanOrEqual(EPITAPH_MAX);
  });

  test('every seed epitaph fits the length limit', () => {
    for (let sx = 0; sx < 40; sx++) {
      for (const [tx, ty] of GRAVES) {
        const coord = { layer: OVERWORLD, sx, sy: 0 };
        expect(seedEpitaph(world, coord, { tx, ty }).length).toBeLessThanOrEqual(EPITAPH_MAX);
      }
    }
  });
});

describe('a grave bubble', () => {
  /** Centre tile (11, 8), in reach of the grave at (11, 7). */
  const pose: Pose = { x: 184, y: 142, dir: 'n', moving: false };
  const T0 = Date.UTC(2026, 8, 25);
  const said = (place: Place, now: number) =>
    bubblesAt({
      place,
      me: { id: 1, name: 'ann', pose },
      others: [],
      inventory: EMPTY_INVENTORY,
      now,
    }).filter((s) => s.tile.tx === 11 && s.tile.ty === 7);

  test('reads the epitaph, and who left flowers on its second line while they last', () => {
    const words: Trace = { kind: 'epitaph', tx: 11, ty: 7, text: 'Gone fishing', source: 'model' };
    const flowers: Trace = {
      kind: 'flowers',
      tx: 11,
      ty: 7,
      species: 'Cornflower',
      by: { id: 2, name: 'bob' },
      at: T0,
    };
    const place = placeOf(screen, [flowers, words]);
    expect(said(place, T0)).toEqual([
      {
        tile: { tx: 11, ty: 7 },
        kind: 'epitaph',
        bubble: { text: 'Gone fishing', line: 'Cornflower, left by bob' },
      },
    ]);
    expect(said(place, T0 + 6 * DAY_MS)).toEqual([
      { tile: { tx: 11, ty: 7 }, kind: 'epitaph', bubble: { text: 'Gone fishing' } },
    ]);
  });

  test('speaks only to a player facing it, among graves on every side', () => {
    const graves: Trace[] = [];
    for (let ty = 5; ty <= 9; ty++)
      for (let tx = 9; tx <= 13; tx++)
        if (tx !== 11 || ty !== 7)
          graves.push({ kind: 'epitaph', tx, ty, text: `${tx},${ty}`, source: 'model' });
    graves.push({
      kind: 'flowers',
      tx: 10,
      ty: 7,
      species: 'Cornflower',
      by: { id: 2, name: 'bob' },
      at: T0,
    });
    const place = placeOf(uniformScreen(), graves);
    const read = (dir: Pose['dir']) =>
      bubblesAt({
        place,
        me: { id: 1, name: 'ann', pose: { x: 11.5 * 16, y: 8 * 16 - 2, dir, moving: false } },
        others: [],
        inventory: EMPTY_INVENTORY,
        now: T0,
      }).map((s) => [s.bubble.text, s.bubble.line]);
    expect(read('n')).toEqual([['11,6', undefined]]);
    expect(read('s')).toEqual([['11,8', undefined]]);
    expect(read('e')).toEqual([['12,7', undefined]]);
    expect(read('w')).toEqual([['10,7', 'Cornflower, left by bob']]);
  });
});

test('a generated grave lies in the graveyard, burial ground or ruin around it', () => {
  const w = worldOf(7);
  const pois = networkOf(w, OVERWORLD)
    .poisIn({ x0: -400, y0: -300, x1: 400, y1: 300 })
    .filter((p) => p.kind === 'graveyard' || p.kind === 'burialground')
    .slice(0, 4);
  expect(pois.length).toBeGreaterThan(0);
  let graves = 0;
  for (const poi of pois) {
    const coord = {
      layer: OVERWORLD,
      sx: Math.floor(poi.x / SCREEN_W),
      sy: Math.floor(poi.y / SCREEN_H),
    };
    const generated: Screen = generateScreen(w, coord);
    for (let ty = 0; ty < SCREEN_H; ty++) {
      for (let tx = 0; tx < SCREEN_W; tx++) {
        if (featureAt(generated, tx, ty) !== 'grave') continue;
        graves++;
        expect(['graveyard', 'burialground', 'ruin']).toContain(
          landmarkAround(w, coord, { tx, ty }),
        );
      }
    }
  }
  expect(graves).toBeGreaterThan(0);
});
