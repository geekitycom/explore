import {
  FEATURES,
  SCREEN_H,
  SCREEN_W,
  TILE,
  featureAt,
  type Feature,
  type Screen,
} from '@explore/core';
import type { Art } from './load.ts';
import { cell, tileHash, type Rect, type SpriteRef } from './sheets.ts';
import type { Sway } from './wind.ts';

type PlacedFeature = Exclude<Feature, 'none'>;

export type FeatureVariant = {
  readonly ref: SpriteRef;
  /** How the sprite bends in the wind; absent for things that never move. */
  readonly sway?: Sway;
  /** Frames laid out left to right after `ref`, played in a loop. */
  readonly frames?: number;
  /** Drops petals. */
  readonly sheds?: boolean;
};

const ROUND_TREE: Sway = { still: 9, bands: 2 };
const PINE: Sway = { still: 7, bands: 2 };
const BUSH: Sway = { still: 6, bands: 1 };
const GRASS: Sway = { still: 5, bands: 2 };
const FLOWER: Sway = { still: 7, bands: 1 };

/** Variants per feature; a variant listed twice is picked twice as often. */
export const FEATURE_ART: Record<PlacedFeature, readonly FeatureVariant[]> = {
  tree: [
    { ref: cell('nature', 0, 0, 2, 2), sway: ROUND_TREE },
    { ref: cell('nature', 0, 0, 2, 2), sway: ROUND_TREE },
    { ref: cell('nature', 2, 0, 2, 2), sway: PINE },
    { ref: cell('nature', 16, 0, 2, 2), sway: ROUND_TREE },
    { ref: cell('nature', 18, 0, 2, 2), sway: ROUND_TREE },
    { ref: cell('nature', 14, 0, 2, 2), sway: ROUND_TREE, sheds: true },
  ],
  bush: [
    { ref: cell('nature', 0, 10), sway: BUSH },
    { ref: cell('nature', 1, 10), sway: BUSH },
    { ref: cell('nature', 6, 10), sway: BUSH },
  ],
  rock: [{ ref: cell('nature', 18, 9) }, { ref: cell('nature', 15, 9) }],
  flowers: [
    { ref: cell('nature', 0, 11), sway: FLOWER },
    { ref: cell('nature', 1, 11), sway: FLOWER },
    { ref: cell('nature', 2, 11), sway: FLOWER },
    { ref: cell('nature', 3, 11), sway: FLOWER },
    { ref: cell('plant', 0, 0), frames: 4 },
  ],
  tallgrass: [
    { ref: cell('nature', 3, 10), sway: GRASS },
    { ref: cell('nature', 4, 10), sway: GRASS },
    { ref: cell('nature', 7, 10), sway: GRASS },
  ],
};

/** A feature ready to draw: `image` cropped to `src`, at screen pixel (dx, dy). */
export type PlacedSprite = {
  readonly feature: PlacedFeature;
  readonly tx: number;
  readonly ty: number;
  readonly image: CanvasImageSource;
  readonly src: Rect;
  readonly dx: number;
  readonly dy: number;
  /** The y to sort by when drawing features and players back to front. */
  readonly sortY: number;
  readonly variant: FeatureVariant;
  /** Per-tile offset so animated neighbours don't move in lockstep, in [0, 1). */
  readonly phase: number;
};

/** Features anchored bottom-centre on their tile, so 32px trees overhang the tiles above. */
export function featureSprites(screen: Screen, art: Art): PlacedSprite[] {
  const sprites: PlacedSprite[] = [];
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const feature = featureAt(screen, tx, ty);
      if (feature === 'none') continue;
      const variants = FEATURE_ART[feature];
      const hash = tileHash(screen.coord, tx, ty, FEATURES.indexOf(feature));
      const variant = variants[hash % variants.length]!;
      const { sheet, rect } = variant.ref;
      const bottom = (ty + 1) * TILE;
      sprites.push({
        feature,
        tx,
        ty,
        image: art.sheets[sheet],
        src: rect,
        dx: tx * TILE + (TILE - rect.w) / 2,
        dy: bottom - rect.h,
        sortY: bottom,
        variant,
        phase: (hash >>> 20) / 0x1000,
      });
    }
  }
  return sprites;
}
