import { describe, expect, test } from 'vitest';
import { FENCE_KINDS } from '../fences.ts';
import { OUTLINE, RAMPS, type Hex } from '../palette.ts';
import { hexAt, styleViolations, type PixelImage } from '../sprite.ts';
import { FENCES, TILE, type Fence } from '../world.ts';
import { LINK, drawRecipe } from './index.ts';

const { n, e, s, w } = LINK;
const SEEDS = [3, 7922, 15841, 23760, 31679];

/** Tiles of a layout as [tx, ty, links]; every layout is closed, so its outside edge is outlined. */
const LAYOUTS: Record<string, readonly (readonly [number, number, number])[]> = {
  ring: [
    [0, 0, e | s],
    [1, 0, e | w],
    [2, 0, w | s],
    [0, 1, n | s],
    [2, 1, n | s],
    [0, 2, n | e],
    [1, 2, e | w],
    [2, 2, w | n],
  ],
  cross: [
    [1, 0, s],
    [0, 1, e],
    [1, 1, n | e | s | w],
    [2, 1, w],
    [1, 2, n],
  ],
  tees: [
    [0, 0, e | s],
    [1, 0, e | w | s],
    [2, 0, w],
    [0, 1, n],
    [1, 1, n],
  ],
  post: [[0, 0, 0]],
};

function compose(
  fence: Fence,
  layout: (typeof LAYOUTS)[string],
  seed: number,
  broken: (i: number) => boolean,
): PixelImage {
  const width = (Math.max(...layout.map(([tx]) => tx)) + 1) * TILE;
  const height = (Math.max(...layout.map(([, ty]) => ty)) + 1) * TILE;
  const rgba = new Uint8ClampedArray(width * height * 4);
  layout.forEach(([tx, ty, links], i) => {
    const params = { style: fence, material: FENCE_KINDS[fence].material, links };
    const piece = drawRecipe(
      { family: 'fence', params: { ...params, broken: broken(i) } },
      seed + i,
    );
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const from = (y * TILE + x) * 4;
        if (piece.rgba[from + 3] === 0) continue;
        rgba.set(
          piece.rgba.subarray(from, from + 4),
          ((ty * TILE + y) * width + tx * TILE + x) * 4,
        );
      }
    }
  });
  return { width, height, rgba };
}

const mixes = {
  whole: () => false,
  broken: () => true,
  mixed: (i: number) => i % 2 === 1,
};

describe('fence pieces', () => {
  test.each(FENCES)(
    '%s joins into runs, corners, and crossings that pass the style lint',
    (fence) => {
      const failures: string[] = [];
      for (const [name, layout] of Object.entries(LAYOUTS)) {
        for (const [mix, broken] of Object.entries(mixes)) {
          for (const seed of SEEDS) {
            const rules = new Set(
              styleViolations(compose(fence, layout, seed, broken)).map((v) => v.rule),
            );
            if (rules.size) failures.push(`${name} ${mix} seed ${seed}: ${[...rules].join()}`);
          }
        }
      }
      expect(failures).toEqual([]);
    },
  );

  test.each(FENCES)('%s uses only its material and the outline', (fence) => {
    const own = new Set<Hex>([OUTLINE, ...RAMPS[FENCE_KINDS[fence].material]]);
    const image = compose(fence, LAYOUTS.ring!, 1, mixes.mixed);
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        if (image.rgba[(y * image.width + x) * 4 + 3] !== 255) continue;
        expect(own.has(hexAt(image, x, y)), `${x},${y}`).toBe(true);
      }
    }
  });

  test.each(FENCES)('%s looks broken at every seed and every set of links', (fence) => {
    const { material } = FENCE_KINDS[fence];
    const same: string[] = [];
    for (let links = 0; links < 16; links++) {
      for (const seed of SEEDS) {
        const draw = (broken: boolean) =>
          drawRecipe({ family: 'fence', params: { style: fence, material, links, broken } }, seed)
            .rgba;
        if (draw(true).every((v, i) => v === draw(false)[i])) same.push(`${links}/${seed}`);
      }
    }
    expect(same).toEqual([]);
  });
});
