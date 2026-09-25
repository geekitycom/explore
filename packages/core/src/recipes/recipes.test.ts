import { describe, expect, test } from 'vitest';
import { OUTLINE, RAMPS, type Hex, type RampName } from '../palette.ts';
import { SHADOW, hexAt, styleViolations, type Sprite } from '../sprite.ts';
import { TILE } from '../world.ts';
import { FLORA } from '../flora.ts';
import { RECIPE_FAMILIES, SAMPLE_RECIPES, drawRecipe, type Recipe } from './index.ts';

const SEEDS = Array.from({ length: 24 }, (_, i) => i * 7919 + 3);
const RAMP_NAMES = Object.keys(RAMPS) as RampName[];
const isRamp = (v: unknown): v is RampName => typeof v === 'string' && v in RAMPS;

/**
 * Every sample, plus each of its ramp params swapped for every ramp, plus the other sizes, plus
 * every species in the flora catalogue.
 */
function species(): Recipe[] {
  const out: Recipe[] = Object.values(FLORA).flatMap((flora) =>
    Object.values(flora).flatMap((list) => list.map((s) => s.recipe)),
  );
  for (const sample of Object.values(SAMPLE_RECIPES)) {
    out.push(sample);
    for (const [key, value] of Object.entries(sample.params)) {
      if (!isRamp(value)) continue;
      for (const name of RAMP_NAMES) {
        out.push({ ...sample, params: { ...sample.params, [key]: name } } as Recipe);
      }
    }
  }
  const tree = SAMPLE_RECIPES.tree.params;
  for (const shape of ['broadleaf', 'conifer'] as const) {
    for (const tiles of [2, 3] as const) {
      for (const spread of [6, 15]) {
        out.push({ family: 'tree', params: { ...tree, shape, tiles, spread, trunk: tiles * 4 } });
      }
    }
  }
  out.push({ family: 'cactus', params: { skin: 'sage', tiles: 1, arms: 3 } });
  out.push({ family: 'reeds', params: { stems: 'grass', tiles: 1 } });
  out.push({ family: 'rock', params: { stone: 'granite', moss: 'sage', size: 0 } });
  out.push({ family: 'grass', params: { blades: 'straw', tips: 'snow', height: 12 } });
  return out;
}

const bytes = (s: Sprite) => Array.from(s.rgba);

function opaqueColours(s: Sprite): Set<Hex> {
  const out = new Set<Hex>();
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      if (s.rgba[(y * s.width + x) * 4 + 3] === 255) out.add(hexAt(s, x, y));
    }
  }
  return out;
}

describe('recipes', () => {
  test('cover the eight families', () => {
    expect(RECIPE_FAMILIES.sort()).toEqual(
      ['bush', 'cactus', 'flower', 'grass', 'mushroom', 'reeds', 'rock', 'tree'].sort(),
    );
  });

  test.each(RECIPE_FAMILIES)('%s draws the same pixels for the same seed', (family) => {
    const recipe = SAMPLE_RECIPES[family];
    for (const seed of SEEDS) {
      expect(bytes(drawRecipe(recipe, seed))).toEqual(bytes(drawRecipe(recipe, seed)));
    }
  });

  test.each(RECIPE_FAMILIES)('%s varies between neighbouring seeds', (family) => {
    const recipe = SAMPLE_RECIPES[family];
    const distinct = new Set(SEEDS.map((seed) => bytes(drawRecipe(recipe, seed)).join()));
    expect(distinct.size).toBeGreaterThanOrEqual(SEEDS.length * 0.9);
  });

  test('every species at every seed passes the style lint', () => {
    const failures: string[] = [];
    for (const recipe of species()) {
      for (const seed of SEEDS) {
        const rules = new Set(styleViolations(drawRecipe(recipe, seed)).map((v) => v.rule));
        if (rules.size)
          failures.push(`${JSON.stringify(recipe)} seed ${seed}: ${[...rules].join()}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test('a species only uses its own ramps and the outline, so every seed reads as that species', () => {
    for (const recipe of species()) {
      const own = new Set<Hex>([OUTLINE]);
      for (const value of Object.values(recipe.params)) {
        if (isRamp(value)) for (const hex of RAMPS[value]) own.add(hex);
      }
      for (const seed of SEEDS) {
        const stray = [...opaqueColours(drawRecipe(recipe, seed))].filter((hex) => !own.has(hex));
        expect(stray, JSON.stringify(recipe)).toEqual([]);
      }
    }
  });

  test('sprites anchor bottom-centre, fit their tiles, and stand on the tile bottom', () => {
    for (const recipe of species()) {
      for (const seed of SEEDS) {
        const s = drawRecipe(recipe, seed);
        expect(s.width % TILE).toBe(0);
        expect(s.height % TILE).toBe(0);
        expect(s.height).toBeLessThanOrEqual(3 * TILE);
        expect(s.anchor).toEqual({ x: s.width / 2, y: s.height });
        let bottom = -1;
        let left = s.width;
        let right = -1;
        for (let y = 0; y < s.height; y++) {
          for (let x = 0; x < s.width; x++) {
            if (s.rgba[(y * s.width + x) * 4 + 3] !== 255) continue;
            if (y > bottom) [bottom, left, right] = [y, x, x];
            else if (y === bottom) right = x;
          }
        }
        expect(bottom, JSON.stringify(recipe)).toBeGreaterThanOrEqual(s.height - 2);
        expect(
          Math.abs((left + right + 1) / 2 - s.anchor.x),
          JSON.stringify(recipe),
        ).toBeLessThanOrEqual(3);
      }
    }
  });

  test('props and rocks fit one tile, trees two or three tiles tall', () => {
    for (const family of ['bush', 'rock', 'flower', 'grass', 'mushroom'] as const) {
      const s = drawRecipe(SAMPLE_RECIPES[family], 1);
      expect([s.width, s.height]).toEqual([TILE, TILE]);
    }
    const tree = SAMPLE_RECIPES.tree;
    expect(drawRecipe({ ...tree, params: { ...tree.params, tiles: 3 } }, 1).height).toBe(3 * TILE);
  });
});

describe('style lint', () => {
  function image(rows: readonly string[], colours: Record<string, readonly number[]>): Sprite {
    const width = rows[0]!.length;
    const rgba = new Uint8ClampedArray(width * rows.length * 4);
    rows.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (colours[ch]) rgba.set(colours[ch], (y * width + x) * 4);
      }),
    );
    return { width, height: rows.length, anchor: { x: width / 2, y: rows.length }, rgba };
  }
  const O = [0x14, 0x1b, 0x1b, 255];
  const G = [0x74, 0xa3, 0x34, 255];
  const rules = (s: Sprite) => styleViolations(s).map((v) => `${v.rule}@${v.x},${v.y}`);

  test('passes an outlined sprite with a shadow', () => {
    const shadow = [0x14, 0x1b, 0x1b, SHADOW.alpha];
    expect(rules(image(['.o.', 'ogo', '.o.', 'sss'], { o: O, g: G, s: shadow }))).toEqual([]);
  });

  test('reports each broken rule at its pixel', () => {
    const offPalette = [0x12, 0x34, 0x56, 255];
    const halfGreen = [0x74, 0xa3, 0x34, 128];
    expect(
      rules(image(['ogo', '...', 'x.h'], { o: O, g: G, x: offPalette, h: halfGreen })),
    ).toEqual([
      'open-outline@1,0',
      'off-palette@0,2',
      'stray-pixel@0,2',
      'open-outline@0,2',
      'partial-alpha@2,2',
    ]);
  });

  test('reports more than eight colours once', () => {
    const greens = [...RAMPS.grass, ...RAMPS.water].map((hex) => {
      const n = Number.parseInt(hex.slice(1), 16);
      return [n >> 16, (n >> 8) & 255, n & 255, 255];
    });
    const keys = 'abcdefghijk';
    const colours = Object.fromEntries(greens.map((c, i) => [keys[i]!, c]));
    const row = keys.slice(0, greens.length);
    const found = styleViolations(
      image(['o'.repeat(row.length + 2), `o${row}o`, 'o'.repeat(row.length + 2)], {
        ...colours,
        o: O,
      }),
    );
    expect(found.filter((v) => v.rule === 'too-many-colours')).toHaveLength(1);
  });
});
