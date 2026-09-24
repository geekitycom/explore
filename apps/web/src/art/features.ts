import {
  FEATURES,
  SCREEN_H,
  SCREEN_W,
  TILE,
  featureAt,
  type Feature,
  type Screen,
} from '@explore/core';
import { cell, tileHash, type Rect, type SpriteRef } from './sheets.ts';
import type { Art } from './load.ts';

type PlacedFeature = Exclude<Feature, 'none'>;

/** Variants per feature; a variant listed twice is picked twice as often. */
export const FEATURE_ART: Record<PlacedFeature, readonly SpriteRef[]> = {
  tree: [
    cell('nature', 0, 0, 2, 2),
    cell('nature', 0, 0, 2, 2),
    cell('nature', 2, 0, 2, 2),
    cell('nature', 16, 0, 2, 2),
    cell('nature', 18, 0, 2, 2),
    cell('nature', 14, 0, 2, 2),
  ],
  bush: [cell('nature', 0, 10), cell('nature', 1, 10), cell('nature', 6, 10)],
  rock: [cell('nature', 18, 9), cell('nature', 15, 9)],
  flowers: [
    cell('nature', 0, 11),
    cell('nature', 1, 11),
    cell('nature', 2, 11),
    cell('nature', 3, 11),
    cell('nature', 6, 11),
  ],
  tallgrass: [cell('nature', 3, 10), cell('nature', 4, 10), cell('nature', 7, 10)],
};

/** A sprite ready to draw: `image` cropped to `src`, at screen pixel (dx, dy). */
export type PlacedSprite = {
  readonly image: CanvasImageSource;
  readonly src: Rect;
  readonly dx: number;
  readonly dy: number;
  /** The y to sort by when drawing features and players back to front. */
  readonly sortY: number;
};

/** Features anchored bottom-centre on their tile, so 32px trees overhang the tiles above. */
export function featureSprites(screen: Screen, art: Art): PlacedSprite[] {
  const sprites: PlacedSprite[] = [];
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const feature = featureAt(screen, tx, ty);
      if (feature === 'none') continue;
      const variants = FEATURE_ART[feature];
      const { sheet, rect } =
        variants[tileHash(screen.coord, tx, ty, FEATURES.indexOf(feature)) % variants.length]!;
      const bottom = (ty + 1) * TILE;
      sprites.push({
        image: art.sheets[sheet],
        src: rect,
        dx: tx * TILE + (TILE - rect.w) / 2,
        dy: bottom - rect.h,
        sortY: bottom,
      });
    }
  }
  return sprites;
}
