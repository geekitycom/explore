import {
  FEATURES,
  SCREEN_H,
  SCREEN_W,
  TILE,
  drawRecipe,
  featureAt,
  speciesAt,
  type Family,
  type PlacedFeature,
  type Recipe,
  type Screen,
  type Species,
  type Sprite,
} from '@explore/core';
import { tileHash, type Rect } from './sheets.ts';
import type { Sway } from './wind.ts';

const ROUND_TREE: Sway = { still: 9, bands: 2 };
const PINE: Sway = { still: 7, bands: 2 };
const BUSH: Sway = { still: 6, bands: 1 };
const GRASS: Sway = { still: 5, bands: 2 };
const FLOWER: Sway = { still: 7, bands: 1 };

/** How each family bends in the wind; stones, cacti, and mushrooms never move. */
const SWAY: Record<Family, Sway | undefined> = {
  tree: ROUND_TREE,
  bush: BUSH,
  rock: undefined,
  flower: FLOWER,
  grass: GRASS,
  cactus: undefined,
  reeds: GRASS,
  mushroom: undefined,
};

export function swayOf({ family, params }: Recipe): Sway | undefined {
  return family === 'tree' && params.shape === 'conifer' ? PINE : SWAY[family];
}

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

export type DrawnSprite = { readonly canvas: HTMLCanvasElement; readonly sprite: Sprite };

const drawn = new Map<Recipe, Map<number, DrawnSprite>>();

/** One seed of a species, drawn once and kept. */
export function speciesSprite({ recipe }: Species, seed: number): DrawnSprite {
  let bySeed = drawn.get(recipe);
  if (!bySeed) drawn.set(recipe, (bySeed = new Map<number, DrawnSprite>()));
  let entry = bySeed.get(seed % SPECIES_SEEDS);
  if (!entry) {
    const sprite = drawRecipe(recipe, seed % SPECIES_SEEDS);
    entry = { canvas: spriteCanvas(sprite), sprite };
    bySeed.set(seed % SPECIES_SEEDS, entry);
  }
  return entry;
}

/** A feature ready to draw: `image` cropped to `src`, at screen pixel (dx, dy). */
export type PlacedSprite = {
  readonly feature: PlacedFeature;
  readonly species: Species;
  readonly sway: Sway | undefined;
  readonly tx: number;
  readonly ty: number;
  readonly image: CanvasImageSource;
  readonly src: Rect;
  readonly dx: number;
  readonly dy: number;
  /** The y to sort by when drawing features and players back to front. */
  readonly sortY: number;
  /** Per-tile offset so animated neighbours don't move in lockstep, in [0, 1). */
  readonly phase: number;
};

/**
 * Features anchored bottom-centre on their tile, so 32px trees overhang the tiles above. Each
 * tile's species comes from the screen's biome in the flora catalogue.
 */
export function featureSprites(screen: Screen): PlacedSprite[] {
  const sprites: PlacedSprite[] = [];
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const feature = featureAt(screen, tx, ty);
      if (feature === 'none') continue;
      const hash = tileHash(screen.coord, tx, ty, FEATURES.indexOf(feature));
      const species = speciesAt(screen.biome, feature, hash);
      const { canvas, sprite } = speciesSprite(species, hash >>> 8);
      const bottom = (ty + 1) * TILE;
      sprites.push({
        feature,
        species,
        sway: swayOf(species.recipe),
        tx,
        ty,
        image: canvas,
        src: { x: 0, y: 0, w: sprite.width, h: sprite.height },
        dx: tx * TILE + TILE / 2 - sprite.anchor.x,
        dy: bottom - sprite.anchor.y,
        sortY: bottom,
        phase: (hash >>> 20) / 0x1000,
      });
    }
  }
  return sprites;
}
