import { expect, test } from 'vitest';
import { generateScreen } from './generate.ts';
import { worldOf } from './testing.ts';
import { OVERWORLD } from './world.ts';

test('generates a screen in under 10 ms', () => {
  const world = worldOf(11);
  const started = Date.now();
  const n = 200;
  for (let i = 0; i < n; i++) generateScreen(world, { layer: OVERWORLD, sx: i % 20, sy: 30 + i });
  expect((Date.now() - started) / n).toBeLessThan(10);
});
