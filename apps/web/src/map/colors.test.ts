import { SCREEN_W, secretGarden } from '@explore/core';
import { uniformScreen, withCorners, withFeatures } from '@explore/core/testing';
import { expect, test } from 'vitest';
import { FEATURE_COLOR, TERRAIN_COLOR, screenPixels } from './colors.ts';

const pixel = (px: Uint8ClampedArray, tx: number, ty: number) => [
  ...px.subarray((ty * SCREEN_W + tx) * 4, (ty * SCREEN_W + tx) * 4 + 4),
];

test('each tile takes its majority terrain and is opaque', () => {
  const px = screenPixels(
    withCorners(uniformScreen('grass'), [
      [5, 5, 'water'],
      [6, 5, 'water'],
      [5, 6, 'water'],
    ]),
  );
  expect(pixel(px, 5, 5)).toEqual([...TERRAIN_COLOR.water, 255]);
  expect(pixel(px, 0, 0)).toEqual([...TERRAIN_COLOR.grass, 255]);
});

test('features tint their tile so forests show on the map', () => {
  const px = screenPixels(withFeatures(uniformScreen('grass'), [[2, 3, 'tree']]));
  const [r, g, b] = pixel(px, 2, 3);
  const tree = FEATURE_COLOR.tree!;
  expect(Math.abs(r! - tree[0]) + Math.abs(g! - tree[1]) + Math.abs(b! - tree[2])).toBeLessThan(
    Math.abs(r! - TERRAIN_COLOR.grass[0]) + Math.abs(g! - TERRAIN_COLOR.grass[1]),
  );
});

test('the garden pond reads as water', () => {
  expect(pixel(screenPixels(secretGarden()), 9, 7)).toEqual([...TERRAIN_COLOR.water, 255]);
});
