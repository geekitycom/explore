import { PALETTE, type Hex } from '../src/palette.ts';
import { hexAt, styleViolations, type PixelImage, type StyleRule } from '../src/sprite.ts';
import { hexToLab } from './photo-palette.ts';

/** How the lint reads one shipped sheet. */
export type ArtSheet = {
  /** One sprite's size. Per-sprite rules apply cell by cell; omitted, the sheet is one image. */
  readonly cell?: { readonly w: number; readonly h: number };
  /** Rules the pack breaks on purpose in this sheet, each with its reason. */
  readonly exempt: Partial<Record<StyleRule, string>>;
  /** Avatars recolour this sheet by source colour, so a remap must not merge two colours. */
  readonly distinct?: true;
};

const GROUND: ArtSheet['exempt'] = {
  'open-outline': 'ground gets no outline',
  'too-many-colours': 'a tileset is many ground tiles, not one sprite',
};

const CHARACTER: ArtSheet = {
  cell: { w: 16, h: 16 },
  distinct: true,
  exempt: {
    'open-outline': 'feet stand on the ground, which the pack never outlines',
    'too-many-colours': 'pack characters use up to 10 colours, and avatars recolour them by role',
  },
};

/** Every PNG under apps/web/public, by path relative to it. */
export const SHIPPED_ART: Readonly<Record<string, ArtSheet>> = {
  'assets/ninja-adventure/Backgrounds/Tilesets/TilesetFloor.png': { exempt: GROUND },
  'assets/ninja-adventure/Backgrounds/Tilesets/TilesetWater.png': { exempt: GROUND },
  'assets/ninja-adventure/Actor/Character/Boy/SeparateAnim/Walk.png': CHARACTER,
  'assets/ninja-adventure/Actor/Character/Princess/SeparateAnim/Walk.png': CHARACTER,
  'assets/ninja-adventure/Actor/Character/SamuraiBlue/SeparateAnim/Walk.png': CHARACTER,
  'assets/ninja-adventure/Actor/Character/Villager3/SeparateAnim/Walk.png': CHARACTER,
  'assets/ninja-adventure/FX/Particle/LeafPink.png': { cell: { w: 12, h: 7 }, exempt: {} },
  'assets/ninja-adventure/Actor/Animal/Fish/SpriteSheetWhite.png': {
    cell: { w: 16, h: 16 },
    exempt: {},
  },
};

/** A style violation at its position in the whole sheet, with the colour found there. */
type ArtFinding = {
  readonly rule: StyleRule;
  readonly x: number;
  readonly y: number;
  readonly colour: Hex;
};

function crop(image: PixelImage, x0: number, y0: number, w: number, h: number): PixelImage {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * image.width + x0) * 4;
    rgba.set(image.rgba.subarray(from, from + w * 4), y * w * 4);
  }
  return { width: w, height: h, rgba };
}

export function lintSheet(image: PixelImage, sheet: ArtSheet): ArtFinding[] {
  const { w, h } = sheet.cell ?? { w: image.width, h: image.height };
  const out: ArtFinding[] = [];
  for (let y0 = 0; y0 + h <= image.height; y0 += h) {
    for (let x0 = 0; x0 + w <= image.width; x0 += w) {
      for (const v of styleViolations(crop(image, x0, y0, w, h))) {
        if (sheet.exempt[v.rule]) continue;
        const x = x0 + v.x;
        const y = y0 + v.y;
        out.push({ rule: v.rule, x, y, colour: hexAt(image, x, y) });
      }
    }
  }
  return out;
}

const PALETTE_LABS = PALETTE.map((hex) => [hex, hexToLab(hex)] as const);

function nearestUnused(hex: Hex, used: ReadonlySet<Hex>): Hex {
  const [L, a, b] = hexToLab(hex);
  let best: Hex | undefined;
  let bestDistance = Infinity;
  for (const [candidate, [cL, ca, cb]] of PALETTE_LABS) {
    const distance = (L - cL) ** 2 + (a - ca) ** 2 + (b - cb) ** 2;
    if (distance < bestDistance && !used.has(candidate))
      [best, bestDistance] = [candidate, distance];
  }
  if (!best) throw new Error(`no palette colour left for ${hex}`);
  return best;
}

/**
 * Each off-palette colour becomes its nearest palette colour in OKLab. With `distinct`, that is
 * the nearest the sheet does not already use, commonest colours choosing first. A sheet already
 * on the palette comes back unchanged.
 */
export function remapToPalette(
  image: PixelImage,
  distinct = false,
): { image: PixelImage; moves: Map<Hex, Hex> } {
  const counts = new Map<Hex, number>();
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.rgba[(y * image.width + x) * 4 + 3] === 0) continue;
      const hex = hexAt(image, x, y);
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
  }
  const used = new Set([...counts.keys()].filter((hex) => PALETTE.includes(hex)));
  const moves = new Map<Hex, Hex>();
  for (const [hex] of [...counts].sort((p, q) => q[1] - p[1])) {
    if (used.has(hex)) continue;
    const to = nearestUnused(hex, distinct ? used : new Set());
    used.add(to);
    moves.set(hex, to);
  }
  const rgba = new Uint8ClampedArray(image.rgba);
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) continue;
    const to = moves.get(hexAt(image, (i / 4) % image.width, Math.floor(i / 4 / image.width)));
    if (!to) continue;
    const n = Number.parseInt(to.slice(1), 16);
    rgba.set([n >> 16, (n >> 8) & 255, n & 255], i);
  }
  return { image: { width: image.width, height: image.height, rgba }, moves };
}
