import { expect, test } from 'vitest';
import { CHUNK_H, CHUNK_W, OVERWORLD, chunkOf, chunkScreens, screenKey } from './world.ts';

test('a chunk covers CHUNK_W by CHUNK_H screens, on both sides of the origin', () => {
  expect(chunkOf({ layer: OVERWORLD, sx: 0, sy: 0 })).toEqual({ layer: OVERWORLD, cx: 0, cy: 0 });
  expect(chunkOf({ layer: OVERWORLD, sx: 3, sy: 3 })).toEqual({ layer: OVERWORLD, cx: 0, cy: 0 });
  expect(chunkOf({ layer: OVERWORLD, sx: -1, sy: 4 })).toEqual({ layer: OVERWORLD, cx: -1, cy: 1 });
  expect(chunkOf({ layer: OVERWORLD, sx: -4, sy: -5 })).toEqual({
    layer: OVERWORLD,
    cx: -1,
    cy: -2,
  });
});

test('chunkScreens lists every screen of the chunk once, and each maps back to it', () => {
  const chunk = { layer: OVERWORLD, cx: -1, cy: 2 };
  const screens = chunkScreens(chunk);
  expect(screens).toHaveLength(CHUNK_W * CHUNK_H);
  expect(new Set(screens.map(screenKey)).size).toBe(screens.length);
  expect(screens[0]).toEqual({ layer: OVERWORLD, sx: -4, sy: 8 });
  expect(screens.at(-1)).toEqual({ layer: OVERWORLD, sx: -1, sy: 11 });
  for (const coord of screens) expect(chunkOf(coord)).toEqual(chunk);
});
