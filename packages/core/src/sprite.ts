import { OUTLINE, PALETTE, type Hex } from './palette.ts';

/** Row-major RGBA pixels, the shape both generated sprites and decoded PNGs take. */
export type PixelImage = {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray<ArrayBuffer>;
};

/** An object sprite. `anchor` is the pixel point that sits on its tile's bottom-centre. */
export type Sprite = PixelImage & { readonly anchor: { readonly x: number; readonly y: number } };

/** Ground shadows are the one partial-alpha colour a sprite may use. */
export const SHADOW: { readonly color: Hex; readonly alpha: number } = {
  color: OUTLINE,
  alpha: 72,
};

const MAX_SPRITE_COLOURS = 8;

export type StyleRule =
  'off-palette' | 'too-many-colours' | 'partial-alpha' | 'stray-pixel' | 'open-outline';

type StyleViolation = { readonly rule: StyleRule; readonly x: number; readonly y: number };

const PALETTE_SET: ReadonlySet<string> = new Set(PALETTE);

export function hexAt({ width, rgba }: PixelImage, x: number, y: number): Hex {
  const i = (y * width + x) * 4;
  const n = (rgba[i]! << 16) | (rgba[i + 1]! << 8) | rgba[i + 2]!;
  return `#${n.toString(16).toUpperCase().padStart(6, '0')}`;
}

/** Breaks of the style guide's per-sprite rules, one per offending pixel (or one per sprite). */
export function styleViolations(image: PixelImage): StyleViolation[] {
  const { width, height, rgba } = image;
  const alpha = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : rgba[(y * width + x) * 4 + 3]!;
  const opaque = (x: number, y: number) => alpha(x, y) === 255;
  const out: StyleViolation[] = [];
  const colours = new Set<Hex>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = alpha(x, y);
      if (a === 0) continue;
      const hex = hexAt(image, x, y);
      colours.add(hex);
      if (a !== 255) {
        if (a !== SHADOW.alpha || hex !== SHADOW.color) out.push({ rule: 'partial-alpha', x, y });
        continue;
      }
      if (!PALETTE_SET.has(hex)) out.push({ rule: 'off-palette', x, y });
      const neighbours = [opaque(x - 1, y), opaque(x + 1, y), opaque(x, y - 1), opaque(x, y + 1)];
      if (!neighbours.some(Boolean)) out.push({ rule: 'stray-pixel', x, y });
      if (hex !== OUTLINE && !neighbours.every(Boolean)) out.push({ rule: 'open-outline', x, y });
    }
  }
  if (colours.size > MAX_SPRITE_COLOURS) out.push({ rule: 'too-many-colours', x: 0, y: 0 });
  return out;
}
