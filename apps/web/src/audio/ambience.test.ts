import { LATTICE_W, type Terrain } from '@explore/core';
import { uniformScreen, withCorners, withFeatures } from '@explore/core/testing';
import { describe, expect, test } from 'vitest';
import { ambientMix, type AmbientMix } from './ambience.ts';

const waterCorners = (count: number) =>
  Array.from({ length: count }, (_, i): [number, number, Terrain] => [
    i % LATTICE_W,
    Math.floor(i / LATTICE_W),
    'water',
  ]);

const inRange = (mix: AmbientMix) =>
  Object.values(mix).every((v) => Number.isFinite(v) && v >= 0 && v <= 1);

describe('ambientMix', () => {
  test('an open meadow is all wind', () => {
    expect(ambientMix(uniformScreen('grass'))).toEqual({ wind: 1, river: 0, waves: 0 });
  });

  test('a little water is a river and a lake is waves', () => {
    const pond = ambientMix(withCorners(uniformScreen(), waterCorners(20)));
    expect(pond.river).toBeGreaterThan(0);
    expect(pond.waves).toBe(0);

    const lake = ambientMix(withCorners(uniformScreen(), waterCorners(150)));
    expect(lake.waves).toBeGreaterThan(pond.river);
    expect(lake.river).toBe(0);
    expect(lake.wind).toBeLessThan(pond.wind);
    expect(inRange(lake)).toBe(true);
  });

  test('trees shelter the wind', () => {
    const trees = Array.from({ length: 60 }, (_, i): [number, number, 'tree'] => [
      i % 20,
      i % 15,
      'tree',
    ]);
    expect(ambientMix(withFeatures(uniformScreen(), trees)).wind).toBeLessThan(0.5);
  });

  test('open snow carries wind and no water', () => {
    const mix = ambientMix(uniformScreen('snow'));
    expect(mix.wind).toBeGreaterThan(0);
    expect(mix.river + mix.waves).toBe(0);
    expect(inRange(mix)).toBe(true);
  });
});
