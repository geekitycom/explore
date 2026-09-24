import { HAIR_STYLES, TERRAINS, type HairStyle } from '@explore/core';
import { AVATAR_BASES, WALK_SHEET_SIZE } from './avatars.ts';
import { SHEETS, sheetUrl, type SheetId, type SpriteRef } from './sheets.ts';
import { TERRAIN_ART, type TerrainTextures } from './terrain.ts';

export type Art = {
  readonly sheets: Readonly<Record<SheetId, HTMLImageElement>>;
  readonly terrain: TerrainTextures;
  /** Each hair style's source walk sheet as WALK_SHEET_SIZE square RGBA. */
  readonly walks: Readonly<Record<HairStyle, Uint8ClampedArray>>;
};

async function loadImage(id: SheetId): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = sheetUrl(id);
  await image.decode();
  return image;
}

function pixelsOf(image: HTMLImageElement, { rect }: SpriteRef): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = rect.w;
  canvas.height = rect.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  return ctx.getImageData(0, 0, rect.w, rect.h).data;
}

export async function loadArt(): Promise<Art> {
  const ids = Object.keys(SHEETS) as SheetId[];
  const images = await Promise.all(ids.map(loadImage));
  const sheets = Object.fromEntries(ids.map((id, i) => [id, images[i]!])) as Record<
    SheetId,
    HTMLImageElement
  >;
  const terrain = Object.fromEntries(
    TERRAINS.map((t) => [t, TERRAIN_ART[t].fills.map((ref) => pixelsOf(sheets[ref.sheet], ref))]),
  ) as Record<(typeof TERRAINS)[number], Uint8ClampedArray[]>;
  const walks = Object.fromEntries(
    HAIR_STYLES.map((style) => {
      const { sheet } = AVATAR_BASES[style];
      const ref = { sheet, rect: { x: 0, y: 0, w: WALK_SHEET_SIZE, h: WALK_SHEET_SIZE } };
      return [style, pixelsOf(sheets[sheet], ref)];
    }),
  ) as Record<HairStyle, Uint8ClampedArray>;
  return { sheets, terrain, walks };
}
