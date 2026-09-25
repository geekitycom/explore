import { DEFAULT_AVATAR, HAIR_STYLES, PALETTE, TILE, type Avatar } from '@explore/core';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_BASES,
  WALK_SHEET_SIZE,
  recolorWalk,
  rolePalette,
  walkFrameRect,
  type AvatarBase,
} from './avatars.ts';
import { parseHex } from './color.ts';

const OUTLINE = '#141b1b';
const STRAY = '#123456';
const HEAD_ROW = 4;
const BODY_ROW = 14;

/**
 * A synthetic walk sheet: every frame starts drawing at row 1 (row 2 in odd rows, like the bob),
 * with every source color of the base once on a head row and once on a body row.
 */
function sheetFor(base: AvatarBase) {
  const pixels = new Uint8ClampedArray(WALK_SHEET_SIZE * WALK_SHEET_SIZE * 4);
  const put = (x: number, y: number, hex: string) =>
    pixels.set(parseHex(hex), (y * WALK_SHEET_SIZE + x) * 4);
  const colors = [...Object.keys(base.colors), STRAY];
  for (let fy = 0; fy < 4; fy++)
    for (let fx = 0; fx < 4; fx++) {
      const top = 1 + (fy % 2);
      for (let x = 0; x < TILE; x++) put(fx * TILE + x, fy * TILE + top, OUTLINE);
      colors.forEach((hex, i) => {
        put(fx * TILE + i, fy * TILE + top + HEAD_ROW, hex);
        put(fx * TILE + i, fy * TILE + Math.min(TILE - 1, top + BODY_ROW - 1), hex);
      });
    }
  return { pixels, colors };
}

const avatar: Avatar = {
  ...DEFAULT_AVATAR,
  skin: 'ebony',
  hairColor: 'pink',
  shirt: 'yellow',
  pants: 'purple',
};

describe('recolorWalk', () => {
  for (const style of HAIR_STYLES) {
    const base = AVATAR_BASES[style];
    const palette = rolePalette({ ...avatar, hairStyle: style });

    it(`replaces every ${style} role color and keeps the rest`, () => {
      const { pixels, colors } = sheetFor(base);
      const out = recolorWalk(pixels, base, palette);
      const hexAt = (o: number) => [...out.subarray(o, o + 3)];
      for (let fy = 0; fy < 4; fy++)
        for (let fx = 0; fx < 4; fx++) {
          const top = 1 + (fy % 2);
          colors.forEach((hex, i) => {
            const rule = base.colors[hex];
            const check = (y: number, part: 'head' | 'body') => {
              const o = ((fy * TILE + y) * WALK_SHEET_SIZE + fx * TILE + i) * 4;
              const role = typeof rule === 'object' ? rule[part] : (rule ?? 'keep');
              const expected = role === 'keep' ? parseHex(hex) : palette[role];
              expect(hexAt(o), `${style} ${hex} ${part}`).toEqual([...expected.slice(0, 3)]);
            };
            check(top + HEAD_ROW, 'head');
            check(Math.min(TILE - 1, top + BODY_ROW - 1), 'body');
          });
        }
    });
  }

  it('leaves no source role color behind in any recolored pixel', () => {
    for (const style of HAIR_STYLES) {
      const base = AVATAR_BASES[style];
      const { pixels } = sheetFor(base);
      const out = recolorWalk(pixels, base, rolePalette({ ...avatar, hairStyle: style }));
      const replaced = Object.entries(base.colors)
        .filter(([, rule]) => rule !== 'keep' && typeof rule === 'string')
        .map(([hex]) => parseHex(hex).slice(0, 3).join());
      for (let o = 0; o < out.length; o += 4) {
        if (!out[o + 3]) continue;
        expect(replaced, style).not.toContain([...out.subarray(o, o + 3)].join());
      }
    }
  });

  it('shades outline strokes enclosed by hair but keeps eyes that touch skin', () => {
    const base = AVATAR_BASES.bun;
    const palette = rolePalette({ ...avatar, hairStyle: 'bun' });
    const pixels = new Uint8ClampedArray(WALK_SHEET_SIZE * WALK_SHEET_SIZE * 4);
    const put = (x: number, y: number, hex: string) =>
      pixels.set(parseHex(hex), (y * WALK_SHEET_SIZE + x) * 4);
    for (let y = 1; y < 8; y++) for (let x = 1; x < 8; x++) put(x, y, '#3b3643');
    put(4, 4, OUTLINE);
    for (let y = 9; y < 14; y++) for (let x = 1; x < 8; x++) put(x, y, '#ef914f');
    put(4, 11, OUTLINE);
    const out = recolorWalk(pixels, base, palette);
    const rgbAt = (x: number, y: number) => [
      ...out.subarray((y * WALK_SHEET_SIZE + x) * 4, (y * WALK_SHEET_SIZE + x) * 4 + 3),
    ];
    expect(rgbAt(4, 4)).toEqual([...palette.hairShade.slice(0, 3)]);
    expect(rgbAt(4, 11)).toEqual([...parseHex(OUTLINE).slice(0, 3)]);
  });
});

describe('rolePalette', () => {
  it('derives distinct shade and light colors from each chosen color', () => {
    const palette = rolePalette(avatar);
    const lum = ([r, g, b]: readonly number[]) => r! + g! + b!;
    for (const part of ['hair', 'shirt', 'pants'] as const) {
      expect(lum(palette[`${part}Shade`])).toBeLessThan(lum(palette[part]));
      expect(lum(palette[`${part}Light`])).toBeGreaterThan(lum(palette[part]));
    }
    expect(lum(palette.skinShade)).toBeLessThan(lum(palette.skin));
  });
});

describe('walkFrameRect', () => {
  it('maps s, n, w, e to columns 0-3 and frames to rows', () => {
    expect(walkFrameRect('s', 0)).toEqual({ x: 0, y: 0, w: TILE, h: TILE });
    expect(walkFrameRect('n', 1)).toEqual({ x: TILE, y: TILE, w: TILE, h: TILE });
    expect(walkFrameRect('w', 2)).toEqual({ x: 2 * TILE, y: 2 * TILE, w: TILE, h: TILE });
    expect(walkFrameRect('e', 7)).toEqual({ x: 3 * TILE, y: 3 * TILE, w: TILE, h: TILE });
  });
});

describe('AVATAR_BASES', () => {
  it('keys roles by palette colours, the only colours the walk sheets use', () => {
    for (const base of Object.values(AVATAR_BASES)) {
      for (const hex of Object.keys(base.colors)) expect(PALETTE).toContain(hex.toUpperCase());
    }
  });
});
