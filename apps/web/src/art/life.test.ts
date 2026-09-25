import { SCREEN_PX_H, SCREEN_PX_W, TILE, generateScreen, secretGarden } from '@explore/core';
import { uniformScreen, withFeatures } from '@explore/core/testing';
import { describe, expect, test } from 'vitest';
import {
  butterflies,
  butterflyAt,
  fishAt,
  fishes,
  isOpenWater,
  petalsAt,
  twinkleFill,
  twinkles,
} from './life.ts';

const screens = Array.from({ length: 30 }, (_, seed) =>
  generateScreen({ sx: 3, sy: seed }, seed, {}),
);
const times = Array.from({ length: 600 }, (_, i) => i * 0.37);

describe('water twinkle', () => {
  test('only open water tiles twinkle, and they return to plain water', () => {
    for (const screen of screens) {
      for (const tw of twinkles(screen)) {
        expect(isOpenWater(screen, tw.tx, tw.ty)).toBe(true);
        const fills = new Set(times.map((t) => twinkleFill(tw, t)));
        expect(fills).toEqual(new Set([undefined, 1, 2]));
      }
    }
  });

  test('a lake twinkles and dry land does not', () => {
    expect(twinkles(uniformScreen('water')).length).toBeGreaterThan(50);
    expect(twinkles(uniformScreen('grass'))).toEqual([]);
  });

  test('the garden pond is too small to have open water', () => {
    expect(twinkles(secretGarden())).toEqual([]);
  });
});

describe('butterflies', () => {
  test('stay on screen, flap, and are capped', () => {
    for (const screen of [secretGarden(), ...screens]) {
      const list = butterflies(screen);
      expect(list.length).toBeLessThanOrEqual(3);
      for (const bf of list) {
        const frames = new Set<number>();
        for (const t of times) {
          const { x, y, frame } = butterflyAt(bf, t);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThanOrEqual(SCREEN_PX_W);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThanOrEqual(SCREEN_PX_H);
          frames.add(frame);
        }
        expect(frames).toEqual(new Set([0, 1]));
      }
    }
  });

  test('need flowers', () => {
    expect(butterflies(uniformScreen())).toEqual([]);
    const meadow = withFeatures(uniformScreen(), [
      [2, 2, 'flowers'],
      [3, 2, 'flowers'],
      [9, 9, 'flowers'],
    ]);
    expect(butterflies(meadow).length).toBe(1);
    expect(butterflies(secretGarden())).toEqual(butterflies(secretGarden()));
  });
});

describe('fish', () => {
  test('only swim over open water', () => {
    for (const screen of [uniformScreen('water'), ...screens]) {
      for (const fish of fishes(screen)) {
        for (const t of times) {
          const at = fishAt(fish, t);
          if (!at) continue;
          expect(isOpenWater(screen, Math.floor(at.x / TILE), Math.floor(at.y / TILE))).toBe(true);
          expect(at.alpha).toBeGreaterThan(0);
        }
      }
    }
  });

  test('appear only sometimes and at most two per screen', () => {
    const lake = uniformScreen('water');
    expect(fishes(lake).length).toBe(2);
    const visible = times.filter((t) => fishAt(fishes(lake)[0]!, t)).length;
    expect(visible).toBeGreaterThan(times.length * 0.3);
    expect(visible).toBeLessThan(times.length * 0.8);
    expect(fishes(uniformScreen('grass'))).toEqual([]);
  });
});

describe('petals', () => {
  test('fall from the canopy, drift with the wind, and fade out', () => {
    const source = { x: 100, y: 50, w: 20, seed: 5 };
    const seen = times.flatMap((t) => petalsAt([source], t, () => 1));
    expect(seen.length).toBeGreaterThan(0);
    for (const p of seen) {
      expect(p.y).toBeGreaterThanOrEqual(50);
      expect(p.x).toBeGreaterThanOrEqual(97);
      expect(p.alpha).toBeGreaterThan(0);
      expect(p.alpha).toBeLessThanOrEqual(1);
      expect(p.frame).toBeLessThan(6);
    }
    const calm = times.flatMap((t) => petalsAt([source], t, () => 0));
    const avgX = (ps: { x: number }[]) => ps.reduce((n, p) => n + p.x, 0) / ps.length;
    expect(avgX(seen)).toBeGreaterThan(avgX(calm));
  });
});
