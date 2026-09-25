import { TILE, type ScreenCoord } from '@explore/core';

/** Every Ninja Adventure sheet the client loads, by path under public/assets/ninja-adventure. */
export const SHEETS = {
  floor: 'Backgrounds/Tilesets/TilesetFloor.png',
  water: 'Backgrounds/Tilesets/TilesetWater.png',
  boy: 'Actor/Character/Boy/SeparateAnim/Walk.png',
  princess: 'Actor/Character/Princess/SeparateAnim/Walk.png',
  samuraiBlue: 'Actor/Character/SamuraiBlue/SeparateAnim/Walk.png',
  villager3: 'Actor/Character/Villager3/SeparateAnim/Walk.png',
  plant: 'Backgrounds/Animated/Plant/SpriteSheet16x16.png',
  petal: 'FX/Particle/LeafPink.png',
  fish: 'Actor/Animal/Fish/SpriteSheetWhite.png',
} as const;

export type SheetId = keyof typeof SHEETS;

export function sheetUrl(id: SheetId): string {
  return `${import.meta.env.BASE_URL}assets/ninja-adventure/${SHEETS[id]}`;
}

export type Rect = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type SpriteRef = { readonly sheet: SheetId; readonly rect: Rect };

/** A rect of whole 16px grid cells, as the pack is laid out. */
export function cell(sheet: SheetId, col: number, row: number, cols = 1, rows = 1): SpriteRef {
  return { sheet, rect: { x: col * TILE, y: row * TILE, w: cols * TILE, h: rows * TILE } };
}

export function tileHash({ sx, sy }: ScreenCoord, tx: number, ty: number, salt: number): number {
  let h = Math.imul(sx, 0x27d4eb2d) ^ Math.imul(sy, 0x165667b1) ^ Math.imul(salt + 1, 0x9e3779b1);
  h = Math.imul(h ^ Math.imul(tx + 1, 0x85ebca6b), 0xc2b2ae35);
  h = Math.imul(h ^ Math.imul(ty + 1, 0x27d4eb2f), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return (h ^ (h >>> 13)) >>> 0;
}
