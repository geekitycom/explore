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
  for (const shape of ['broadleaf', 'conifer', 'weeping'] as const) {
    for (const tiles of [2, 3] as const) {
      for (const spread of [6, 15]) {
        out.push({ family: 'tree', params: { ...tree, shape, tiles, spread, trunk: tiles * 4 } });
      }
    }
  }
  out.push({ family: 'cactus', params: { shape: 'column', skin: 'sage', tiles: 1, arms: 3 } });
  out.push({ family: 'cactus', params: { shape: 'barrel', skin: 'sage' } });
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
  test('cover the nine families', () => {
    expect(RECIPE_FAMILIES.sort()).toEqual(
      ['bush', 'cactus', 'flower', 'grass', 'mushroom', 'reeds', 'rock', 'rosette', 'tree'].sort(),
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

  test('each shape keeps the silhouette of its plant at every seed', () => {
    const box = (s: Sprite, keep: (hex: Hex) => boolean = (hex) => hex !== OUTLINE) => {
      let [top, bottom, left, right] = [s.height, -1, s.width, -1];
      for (let y = 0; y < s.height; y++) {
        for (let x = 0; x < s.width; x++) {
          if (s.rgba[(y * s.width + x) * 4 + 3] !== 255 || !keep(hexAt(s, x, y))) continue;
          [top, bottom] = [Math.min(top, y), Math.max(bottom, y)];
          [left, right] = [Math.min(left, x), Math.max(right, x)];
        }
      }
      return { width: right - left + 1, height: bottom - top + 1, bottom };
    };
    /** How much wider the widest row is than the row it stands on. */
    const fan = (s: Sprite) => {
      const rows = Array.from({ length: s.height }, (_, y) => {
        const xs = Array.from({ length: s.width }, (_, x) => x).filter(
          (x) => s.rgba[(y * s.width + x) * 4 + 3] === 255 && hexAt(s, x, y) !== OUTLINE,
        );
        return xs.length ? xs.at(-1)! - xs[0]! + 1 : 0;
      }).filter((w) => w > 0);
      return Math.max(...rows) - rows.at(-1)!;
    };
    const tuft = { family: 'grass', params: { blades: 'sage', height: 7 } } as const;
    const leafy = (hex: Hex) => (RAMPS.grass as readonly Hex[]).includes(hex);
    const willow = {
      family: 'tree',
      params: { shape: 'weeping', leaves: 'grass', bark: 'bark', tiles: 2, spread: 14, trunk: 7 },
    } as const;
    const lime = { ...willow, params: { ...willow.params, shape: 'broadleaf' } } as const;
    for (const seed of SEEDS) {
      const barrel = box(
        drawRecipe({ family: 'cactus', params: { shape: 'barrel', skin: 'cactus' } }, seed),
      );
      expect(barrel.width).toBeGreaterThanOrEqual(barrel.height - 1);
      const column = box(
        drawRecipe(
          { family: 'cactus', params: { shape: 'column', skin: 'cactus', tiles: 1, arms: 0 } },
          seed,
        ),
      );
      expect(column.width).toBeLessThan(column.height - 3);
      expect(fan(drawRecipe(SAMPLE_RECIPES.rosette, seed))).toBeGreaterThanOrEqual(5);
      expect(fan(drawRecipe(tuft, seed))).toBeLessThan(5);
      const ground = 2 * TILE - 3;
      expect(box(drawRecipe(willow, seed), leafy).bottom).toBeGreaterThanOrEqual(ground - 5);
      expect(box(drawRecipe(lime, seed), leafy).bottom).toBeLessThan(ground - 5);
    }
  });

  test('props and rocks fit one tile, trees two or three tiles tall', () => {
    for (const family of ['bush', 'rock', 'flower', 'grass', 'mushroom', 'rosette'] as const) {
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
