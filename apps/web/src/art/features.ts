import {
  FEATURES,
  SCREEN_H,
  SCREEN_W,
  TILE,
  drawRecipe,
  featureAt,
  type Feature,
  type Recipe,
  type Screen,
  type Sprite,
} from '@explore/core';
import type { Art } from './load.ts';
import { cell, tileHash, type Rect, type SpriteRef } from './sheets.ts';
import type { Sway } from './wind.ts';

type PlacedFeature = Exclude<Feature, 'none'>;

export type FeatureVariant = (
  | {
      readonly ref: SpriteRef;
      /** Frames laid out left to right after `ref`, played in a loop. */
      readonly frames?: number;
    }
  | { readonly recipe: Recipe }
) & {
  /** How the sprite bends in the wind; absent for things that never move. */
  readonly sway?: Sway;
  /** Drops petals. */
  readonly sheds?: boolean;
};

const ROUND_TREE: Sway = { still: 9, bands: 2 };
const PINE: Sway = { still: 7, bands: 2 };
const BUSH: Sway = { still: 6, bands: 1 };
const GRASS: Sway = { still: 5, bands: 2 };
const FLOWER: Sway = { still: 7, bands: 1 };

const OAK: Recipe = {
  family: 'tree',
  params: { shape: 'broadleaf', leaves: 'grass', bark: 'bark', tiles: 2, spread: 13, trunk: 5 },
};
const BEECH: Recipe = {
  family: 'tree',
  params: { shape: 'broadleaf', leaves: 'grass', bark: 'stone', tiles: 2, spread: 10, trunk: 7 },
};
const SPRUCE: Recipe = {
  family: 'tree',
  params: { shape: 'conifer', leaves: 'pine', bark: 'bark', tiles: 2, spread: 11, trunk: 3 },
};
const LEAFY: Recipe = { family: 'bush', params: { leaves: 'grass' } };
const BERRIED: Recipe = { family: 'bush', params: { leaves: 'grass', berries: 'poppy' } };
const CHERRY: Recipe = {
  family: 'tree',
  params: { shape: 'broadleaf', leaves: 'rose', bark: 'bark', tiles: 2, spread: 11, trunk: 6 },
};

/** Variants per feature; a variant listed twice is picked twice as often. */
export const FEATURE_ART: Record<PlacedFeature, readonly FeatureVariant[]> = {
  tree: [
    { recipe: OAK, sway: ROUND_TREE },
    { recipe: OAK, sway: ROUND_TREE },
    { recipe: BEECH, sway: ROUND_TREE },
    { recipe: SPRUCE, sway: PINE },
    { recipe: SPRUCE, sway: PINE },
    { recipe: CHERRY, sway: ROUND_TREE, sheds: true },
  ],
  bush: [
    { recipe: LEAFY, sway: BUSH },
    { recipe: LEAFY, sway: BUSH },
    { recipe: BERRIED, sway: BUSH },
  ],
  rock: [
    { recipe: { family: 'rock', params: { stone: 'stone', size: 1 } } },
    { recipe: { family: 'rock', params: { stone: 'stone', moss: 'grass', size: 0.8 } } },
  ],
  flowers: [
    {
      recipe: {
        family: 'flower',
        params: { petals: 'poppy', leaves: 'grass', centre: 'gold', blossoms: 3 },
      },
      sway: FLOWER,
    },
    {
      recipe: {
        family: 'flower',
        params: { petals: 'snow', leaves: 'grass', centre: 'gold', blossoms: 4 },
      },
      sway: FLOWER,
    },
    {
      recipe: { family: 'flower', params: { petals: 'water', leaves: 'grass', blossoms: 3 } },
      sway: FLOWER,
    },
    { ref: cell('plant', 0, 0), frames: 4 },
  ],
  tallgrass: [
    { recipe: { family: 'grass', params: { blades: 'grass', height: 10 } }, sway: GRASS },
  ],
  bigtree: [
    {
      recipe: {
        family: 'tree',
        params: {
          shape: 'broadleaf',
          leaves: 'grass',
          bark: 'bark',
          tiles: 3,
          spread: 15,
          trunk: 9,
        },
      },
      sway: ROUND_TREE,
    },
  ],
};

/**
 * Seeds per species. Each tile picks one from its hash, so neighbours differ, while the set
 * stays small enough to draw each sprite once and keep it.
 */
export const SPECIES_SEEDS = 64;

export function spriteCanvas(sprite: Sprite): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  canvas.getContext('2d')!.putImageData(new ImageData(sprite.rgba, sprite.width), 0, 0);
  return canvas;
}

type DrawnSprite = { readonly canvas: HTMLCanvasElement; readonly sprite: Sprite };

const drawn = new Map<Recipe, Map<number, DrawnSprite>>();

function recipeCanvas(recipe: Recipe, seed: number) {
  let bySeed = drawn.get(recipe);
  if (!bySeed) drawn.set(recipe, (bySeed = new Map<number, DrawnSprite>()));
  let entry = bySeed.get(seed);
  if (!entry) {
    const sprite = drawRecipe(recipe, seed);
    entry = { canvas: spriteCanvas(sprite), sprite };
    bySeed.set(seed, entry);
  }
  return entry;
}

/** A variant's pixels: `image` cropped to `src`, with `anchor` on its tile's bottom-centre. */
export type VariantImage = {
  readonly image: CanvasImageSource;
  readonly src: Rect;
  readonly anchor: { readonly x: number; readonly y: number };
  readonly frames?: number;
};

export function variantImage(variant: FeatureVariant, art: Art, seed: number): VariantImage {
  if ('recipe' in variant) {
    const { canvas, sprite } = recipeCanvas(variant.recipe, seed % SPECIES_SEEDS);
    return {
      image: canvas,
      src: { x: 0, y: 0, w: sprite.width, h: sprite.height },
      anchor: sprite.anchor,
    };
  }
  const { sheet, rect } = variant.ref;
  return {
    image: art.sheets[sheet],
    src: rect,
    anchor: { x: rect.w / 2, y: rect.h },
    ...(variant.frames ? { frames: variant.frames } : {}),
  };
}

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
  /** Frames laid out left to right from `src`, played in a loop. */
  readonly frames?: number;
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
      const { image, src, anchor, frames } = variantImage(variant, art, hash >>> 8);
      const bottom = (ty + 1) * TILE;
      sprites.push({
        feature,
        tx,
        ty,
        image,
        src,
        dx: tx * TILE + TILE / 2 - anchor.x,
        dy: bottom - anchor.y,
        sortY: bottom,
        variant,
        ...(frames ? { frames } : {}),
        phase: (hash >>> 20) / 0x1000,
      });
    }
  }
  return sprites;
}
