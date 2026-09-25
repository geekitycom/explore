import { describe, expect, test } from 'vitest';
import { fenceLinks, isFence } from './fences.ts';
import { generateScreen, networkOf } from './generate.ts';
import { fenceRing } from './poi.ts';
import { LINK } from './recipes/index.ts';
import { worldOf } from './testing.ts';
import {
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  featureAt,
  tileIndex,
  type Feature,
  type Screen,
} from './world.ts';

function screenWith(tiles: Record<string, Feature>): Screen {
  const features = Array<Feature>(SCREEN_W * SCREEN_H).fill('none');
  for (const [at, feature] of Object.entries(tiles)) {
    const [tx, ty] = at.split(',').map(Number) as [number, number];
    features[tileIndex(tx, ty)] = feature;
  }
  return { coord: { layer: OVERWORLD, sx: 0, sy: 0 }, biome: 'meadow', corners: [], features };
}

describe('fenceLinks', () => {
  test('joins the same fence, whole or broken, and nothing else', () => {
    const screen = screenWith({
      '5,5': 'picket',
      '6,5': 'picket-broken',
      '4,5': 'drystone',
      '5,4': 'bush',
      '5,6': 'picket',
    });
    expect(fenceLinks(screen, 5, 5)).toBe(LINK.e | LINK.s);
    expect(fenceLinks(screen, 6, 5)).toBe(LINK.w);
    expect(fenceLinks(screen, 4, 5)).toBe(0);
  });

  test('never joins past the screen edge', () => {
    const screen = screenWith({ '0,0': 'railing', '1,0': 'railing', '0,1': 'railing' });
    expect(fenceLinks(screen, 0, 0)).toBe(LINK.e | LINK.s);
  });
});

describe('fenceRing', () => {
  test('rings the point with a gate in the middle of each side', () => {
    const marks = fenceRing(2, 2, 'picket').map(({ dx, dy }) => `${dx},${dy}`);
    expect(marks).toHaveLength(12);
    for (const gate of ['0,-2', '0,2', '-2,0', '2,0']) expect(marks).not.toContain(gate);
  });
});

describe('generated fences', () => {
  const mod = (v: number, n: number) => ((v % n) + n) % n;
  /** Whether a ring of reach 2 round the point would put a tile on a screen's edge. */
  const nearSeam = ({ x, y }: { x: number; y: number }) =>
    [-2, 2].some(
      (d) =>
        [0, SCREEN_W - 1].includes(mod(Math.floor(x) + d, SCREEN_W)) ||
        [0, SCREEN_H - 1].includes(mod(Math.floor(y) + d, SCREEN_H)),
    );
  const find = (kind: string, seam: boolean) => {
    for (let seed = 1; seed < 40; seed++) {
      const world = worldOf(seed);
      const box = { x0: -600, y0: -450, x1: 600, y1: 450 };
      const poi = networkOf(world, OVERWORLD)
        .poisIn(box)
        .find((p) => p.kind === kind && (!seam || nearSeam(p)));
      if (poi) return { world, poi };
    }
    throw new Error(`no ${kind}`);
  };

  test.each([
    ['ruin', false],
    ['town', true],
    ['graveyard', false],
    ['burialground', false],
  ] as const)('a %s is fenced, and no fence stands on a screen edge', (kind, seam) => {
    const { world, poi } = find(kind, seam);
    const sx = Math.floor(poi.x / SCREEN_W);
    const sy = Math.floor(poi.y / SCREEN_H);
    let fences = 0;
    const onEdge: string[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const screen = generateScreen(world, { layer: OVERWORLD, sx: sx + dx, sy: sy + dy });
        for (let ty = 0; ty < SCREEN_H; ty++) {
          for (let tx = 0; tx < SCREEN_W; tx++) {
            const feature = featureAt(screen, tx, ty);
            if (!isFence(feature)) continue;
            fences++;
            if (tx === 0 || ty === 0 || tx === SCREEN_W - 1 || ty === SCREEN_H - 1) {
              onEdge.push(`${sx + dx},${sy + dy} ${tx},${ty}`);
            }
          }
        }
      }
    }
    expect(fences).toBeGreaterThan(4);
    expect(onEdge).toEqual([]);
  });
});
