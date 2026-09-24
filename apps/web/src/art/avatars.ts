import {
  CLOTH_COLORS,
  HAIR_COLORS,
  SKIN_TONES,
  TILE,
  type Avatar,
  type Dir,
  type HairStyle,
} from '@explore/core';
import { mix, parseHex, type Pixels, type Rgba } from './color.ts';
import type { SheetId, Rect } from './sheets.ts';
import type { Art } from './load.ts';

export type RolePalette = {
  readonly skin: Rgba;
  readonly skinShade: Rgba;
  readonly hair: Rgba;
  readonly hairShade: Rgba;
  readonly hairLight: Rgba;
  readonly shirt: Rgba;
  readonly shirtShade: Rgba;
  readonly shirtLight: Rgba;
  readonly pants: Rgba;
  readonly pantsShade: Rgba;
  readonly pantsLight: Rgba;
};

export type Role = keyof RolePalette;
type RoleRule = Role | 'keep';

/** A source color's role, optionally different on the head and the body. */
type ColorRule = RoleRule | { readonly head: RoleRule; readonly body: RoleRule };

export type AvatarBase = {
  readonly sheet: SheetId;
  /** Rows from the top of each frame's drawn pixels that belong to the head. */
  readonly headRows: number;
  /** Role of each source color, keyed by lowercase hex. Colors not listed are kept. */
  readonly colors: Readonly<Record<string, ColorRule>>;
};

/** One Ninja Adventure character per hair style, chosen for its hair silhouette. */
export const AVATAR_BASES: Record<HairStyle, AvatarBase> = {
  spiky: {
    sheet: 'boy',
    headRows: 11,
    colors: {
      '#d14b34': { head: 'hair', body: 'shirtShade' },
      '#965340': 'hairShade',
      '#ef914f': 'skin',
      '#d3a2c0': 'skinShade',
      '#e3f1f5': { head: 'keep', body: 'shirt' },
      '#548789': 'pants',
      '#2e3939': 'pantsShade',
    },
  },
  long: {
    sheet: 'princess',
    headRows: 12,
    colors: {
      '#3b3643': 'hair',
      '#4e484a': 'hairLight',
      '#a3754e': 'skin',
      '#965340': 'skinShade',
      '#d78b4a': 'shirt',
      '#f1c471': { head: 'keep', body: 'shirtLight' },
      '#8d977f': 'pants',
      '#abc2bc': 'pantsLight',
    },
  },
  bun: {
    sheet: 'samuraiBlue',
    headRows: 11,
    colors: {
      '#3b3643': { head: 'hair', body: 'keep' },
      '#4e484a': 'hairLight',
      '#ef914f': 'skin',
      '#d14b34': { head: 'skinShade', body: 'shirtShade' },
      '#79b8ce': 'shirt',
      '#548789': 'pants',
      '#4a5270': 'pantsShade',
    },
  },
  bowl: {
    sheet: 'villager3',
    headRows: 11,
    colors: {
      '#4e484a': 'hair',
      '#3b3643': 'hairShade',
      '#a3754e': 'skin',
      '#965340': 'skinShade',
      '#56864c': 'shirt',
      '#a8a129': 'shirtLight',
      '#8d977f': 'pants',
      '#abc2bc': 'pantsLight',
    },
  },
};

const SHADOW = parseHex('#2b1d3a');
const HIGHLIGHT = parseHex('#fff4e0');
const shade = (c: Rgba) => mix(c, SHADOW, 0.32);
const light = (c: Rgba) => mix(c, HIGHLIGHT, 0.35);

export function rolePalette(avatar: Avatar): RolePalette {
  const skin = parseHex(SKIN_TONES[avatar.skin]);
  const hair = parseHex(HAIR_COLORS[avatar.hairColor]);
  const shirt = parseHex(CLOTH_COLORS[avatar.shirt]);
  const pants = parseHex(CLOTH_COLORS[avatar.pants]);
  return {
    skin,
    skinShade: shade(skin),
    hair,
    hairShade: shade(hair),
    hairLight: light(hair),
    shirt,
    shirtShade: shade(shirt),
    shirtLight: light(shirt),
    pants,
    pantsShade: shade(pants),
    pantsLight: light(pants),
  };
}

/** Walk sheet layout: columns face s, n, w, e; rows are the four walk frames. */
export const WALK_FRAMES = 4;
const WALK_COLUMN: Record<Dir, number> = { s: 0, n: 1, w: 2, e: 3 };
export const WALK_SHEET_SIZE = 4 * TILE;

export function walkFrameRect(dir: Dir, frame: number): Rect {
  return { x: WALK_COLUMN[dir] * TILE, y: (frame % WALK_FRAMES) * TILE, w: TILE, h: TILE };
}

const rgbKey = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

const OUTLINE = parseHex('#141b1b');
const OUTLINE_KEY = rgbKey(OUTLINE[0], OUTLINE[1], OUTLINE[2]);
const HAIR_ROLES: ReadonlySet<Role | undefined> = new Set(['hair', 'hairShade', 'hairLight']);
const SKIN_ROLES: ReadonlySet<Role | undefined> = new Set(['skin', 'skinShade']);

/**
 * The role of every pixel of a walk sheet, or undefined to keep it. Head and body are told
 * apart per frame from the frame's top drawn row, since frames bob up and down.
 */
export function pixelRoles(source: Uint8ClampedArray, base: AvatarBase): (Role | undefined)[] {
  const rules = new Map(
    Object.entries(base.colors).map(([hex, rule]) => {
      const [r, g, b] = parseHex(hex);
      return [rgbKey(r, g, b), rule] as const;
    }),
  );
  const size = WALK_SHEET_SIZE;
  const keyAt = (i: number) =>
    source[i * 4 + 3] ? rgbKey(source[i * 4]!, source[i * 4 + 1]!, source[i * 4 + 2]!) : -1;
  const roles: (Role | undefined)[] = Array<Role | undefined>(size * size).fill(undefined);
  for (let fy = 0; fy < size; fy += TILE) {
    for (let fx = 0; fx < size; fx += TILE) {
      const rowDrawn = (y: number) => {
        for (let x = 0; x < TILE; x++) if (keyAt((fy + y) * size + fx + x) >= 0) return true;
        return false;
      };
      let top = 0;
      while (top < TILE && !rowDrawn(top)) top++;
      for (let y = top; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const i = (fy + y) * size + fx + x;
          const rule = rules.get(keyAt(i));
          if (!rule) continue;
          const role =
            typeof rule === 'string' ? rule : y - top < base.headRows ? rule.head : rule.body;
          if (role !== 'keep') roles[i] = role;
        }
      }
    }
  }
  // Outline strokes inside the hair (a bun seen from behind) read as a face once the hair is
  // light, so they take the hair shade. Eyes and mouths touch skin and stay dark.
  const insideHair = (i: number) => {
    const x = i % TILE;
    const y = Math.floor(i / size) % TILE;
    if (keyAt(i) !== OUTLINE_KEY || x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1)
      return false;
    const around = [i - 1, i + 1, i - size, i + size];
    if (around.some((n) => keyAt(n) < 0 || SKIN_ROLES.has(roles[n]))) return false;
    return around.some((n) => HAIR_ROLES.has(roles[n]));
  };
  return roles.map((role, i) => (insideHair(i) ? 'hairShade' : role));
}

export function recolorWalk(
  source: Uint8ClampedArray,
  base: AvatarBase,
  palette: RolePalette,
): Pixels {
  const out = new Uint8ClampedArray(source);
  pixelRoles(source, base).forEach((role, i) => {
    if (role) out.set(palette[role].slice(0, 3), i * 4);
  });
  return out;
}

const avatarKey = (a: Avatar) => [a.hairStyle, a.skin, a.hairColor, a.shirt, a.pants].join('/');
const sheetCache = new WeakMap<Art, Map<string, HTMLCanvasElement>>();

/** The avatar's recolored walk sheet, laid out as walkFrameRect describes. Cached per art. */
export function avatarSheet(avatar: Avatar, art: Art): HTMLCanvasElement {
  let cache = sheetCache.get(art);
  if (!cache) sheetCache.set(art, (cache = new Map<string, HTMLCanvasElement>()));
  const key = avatarKey(avatar);
  const cached = cache.get(key);
  if (cached) return cached;
  const base = AVATAR_BASES[avatar.hairStyle];
  const pixels = recolorWalk(art.walks[avatar.hairStyle], base, rolePalette(avatar));
  const canvas = document.createElement('canvas');
  canvas.width = WALK_SHEET_SIZE;
  canvas.height = WALK_SHEET_SIZE;
  canvas
    .getContext('2d')!
    .putImageData(new ImageData(pixels, WALK_SHEET_SIZE, WALK_SHEET_SIZE), 0, 0);
  cache.set(key, canvas);
  return canvas;
}
