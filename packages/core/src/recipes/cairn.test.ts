import { describe, expect, test } from 'vitest';
import { OUTLINE, RAMPS, type Hex, type RampName } from '../palette.ts';
import { hexAt, styleViolations, type Sprite } from '../sprite.ts';
import { TILE } from '../world.ts';
import { CAIRN_MAX, drawRecipe } from './index.ts';

const SEEDS = [1, 7, 42, 99, 1234, 7919];
const COUNTS = Array.from({ length: CAIRN_MAX }, (_, i) => i + 1);
const MATERIALS: readonly RampName[] = ['stone', 'granite', 'sand'];

const cairn = (stones: readonly RampName[], seed: number) =>
  drawRecipe({ family: 'cairn', params: { stones } }, seed);
const same = (material: RampName, n: number) => Array<RampName>(n).fill(material);
const mixed = (n: number) => Array.from({ length: n }, (_, i) => MATERIALS[i % 3]!);

function silhouette(s: Sprite) {
  const cells: string[] = [];
  let [top, bottom, left, right] = [s.height, -1, s.width, -1];
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      if (s.rgba[(y * s.width + x) * 4 + 3] !== 255) continue;
      cells.push(`${x},${y}`);
      [top, bottom] = [Math.min(top, y), Math.max(bottom, y)];
      [left, right] = [Math.min(left, x), Math.max(right, x)];
    }
  }
  return {
    key: cells.join(' '),
    area: cells.length,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function colours(s: Sprite): Set<Hex> {
  const out = new Set<Hex>();
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      if (s.rgba[(y * s.width + x) * 4 + 3] === 255) out.add(hexAt(s, x, y));
    }
  }
  return out;
}

describe('cairn', () => {
  test('every count, material mix and seed passes the style lint', () => {
    const failures: string[] = [];
    for (const n of COUNTS) {
      for (const stones of [...MATERIALS.map((m) => same(m, n)), mixed(n)]) {
        for (const seed of SEEDS) {
          const rules = new Set(styleViolations(cairn(stones, seed)).map((v) => v.rule));
          if (rules.size) failures.push(`${stones.join()} seed ${seed}: ${[...rules].join()}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  test('each stone keeps its own material, even in a cairn of three', () => {
    for (const n of COUNTS.filter((n) => n >= 3)) {
      for (const seed of SEEDS) {
        const used = colours(cairn(mixed(n), seed));
        for (const material of MATERIALS) {
          const own = RAMPS[material].filter((hex) => used.has(hex));
          expect(own.length, `${material} in ${n} stones, seed ${seed}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  test('one stone is a world-sized rock in its material', () => {
    for (const seed of SEEDS) {
      const s = silhouette(cairn(['granite'], seed));
      expect(s.width).toBeGreaterThanOrEqual(10);
      expect(s.height).toBeLessThanOrEqual(TILE);
      const stray = [...colours(cairn(['granite'], seed))].filter(
        (hex) => hex !== OUTLINE && !(RAMPS.granite as readonly Hex[]).includes(hex),
      );
      expect(stray).toEqual([]);
    }
  });

  test('every added stone changes the outline and covers more ground', () => {
    for (const seed of SEEDS) {
      const stages = COUNTS.map((n) => silhouette(cairn(same('stone', n), seed)));
      stages.slice(1).forEach((stage, i) => {
        const before = stages[i]!;
        expect(stage.key, `${i + 2} stones, seed ${seed}`).not.toBe(before.key);
        expect(stage.area, `${i + 2} stones, seed ${seed}`).toBeGreaterThan(before.area);
      });
    }
  });

  test('two stones sit wider than a headstone would, and twelve is about a tile and a half', () => {
    for (const seed of SEEDS) {
      const two = silhouette(cairn(same('stone', 2), seed));
      expect(two.height).toBeLessThan(two.width * 1.6);
      const full = silhouette(cairn(same('stone', CAIRN_MAX), seed));
      expect(full.width).toBeGreaterThanOrEqual(1.25 * TILE);
      expect(full.width).toBeLessThanOrEqual(1.75 * TILE);
      expect(full.height).toBeGreaterThanOrEqual(1.25 * TILE);
      expect(full.height).toBeLessThanOrEqual(2 * TILE);
    }
  });
});
