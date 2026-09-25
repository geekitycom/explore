import { describe, expect, it } from 'vitest';
import { OUTLINE, PALETTE, RAMPS, type Hex } from '../src/palette.ts';
import { hexAt, type PixelImage } from '../src/sprite.ts';
import { lintSheet, remapToPalette, type ArtSheet } from './art-lint.ts';

/** A sheet of `rows`, one character per pixel: '.' is transparent, anything else a key of `keys`. */
function image(rows: string[], keys: Record<string, Hex>): PixelImage {
  const width = rows[0]!.length;
  const rgba = new Uint8ClampedArray(width * rows.length * 4);
  rows.forEach((row, y) =>
    [...row].forEach((key, x) => {
      if (key === '.') return;
      const n = Number.parseInt(keys[key]!.slice(1), 16);
      rgba.set([n >> 16, (n >> 8) & 255, n & 255, 255], (y * width + x) * 4);
    }),
  );
  return { width, height: rows.length, rgba };
}

const OFF: Hex = '#123456';
const [G0, G1, G2, G3, G4] = RAMPS.grass;
const keys = { o: OUTLINE, g: G1, x: OFF };

const sprite = ['oooo', 'oggo', 'oggo', 'oooo'];
const SHEET: ArtSheet = { cell: { w: 4, h: 4 }, exempt: {} };

describe('lintSheet', () => {
  it('reports an off-palette pixel at its position in the whole sheet, with its colour', () => {
    const rows = sprite.map((row, y) => row + (y === 2 ? 'ogxo' : row));
    expect(lintSheet(image(rows, keys), SHEET)).toEqual([
      { rule: 'off-palette', x: 6, y: 2, colour: OFF },
    ]);
  });

  it('reports an over-limit sprite at its cell origin', () => {
    const nine = { ...keys, a: G0, b: G2, c: G3, d: G4, e: RAMPS.poppy[1], f: RAMPS.poppy[2] };
    const rows = ['ooooabcd', 'oggoefga', 'oggobcde', 'oooofoxo'];
    const overLimit = lintSheet(image(rows, nine), SHEET).filter(
      (f) => f.rule === 'too-many-colours',
    );
    expect(overLimit).toEqual([{ rule: 'too-many-colours', x: 4, y: 0, colour: G0 }]);
  });

  it('skips the rules a sheet is exempt from, and only those', () => {
    const open = image(['.gg.', 'gxgg', 'gggg', '.gg.'], keys);
    const exempt: ArtSheet = { ...SHEET, exempt: { 'open-outline': 'ground' } };
    expect(lintSheet(open, exempt).map((f) => f.rule)).toEqual(['off-palette']);
  });
});

describe('remapToPalette', () => {
  it('moves each off-palette colour to its nearest palette colour and keeps the rest', () => {
    const near: Hex = '#57874D';
    const { image: out, moves } = remapToPalette(image(['o.gy'], { ...keys, y: near }));
    expect(moves).toEqual(new Map([[near, G1]]));
    expect([hexAt(out, 0, 0), hexAt(out, 2, 0), hexAt(out, 3, 0)]).toEqual([OUTLINE, G1, G1]);
    expect(out.rgba[7]).toBe(0);
  });

  it('with distinct, never merges an off-palette colour into one the sheet uses', () => {
    const near: Hex = '#57874D';
    const { image: out } = remapToPalette(image(['gy'], { ...keys, y: near }), true);
    expect(hexAt(out, 1, 0)).not.toBe(G1);
    expect(PALETTE).toContain(hexAt(out, 1, 0));
  });

  it('leaves a sheet already on the palette unchanged', () => {
    const img = remapToPalette(image(['oxgx'], keys)).image;
    const again = remapToPalette(img);
    expect(again.moves.size).toBe(0);
    expect(again.image.rgba).toEqual(img.rgba);
  });
});
