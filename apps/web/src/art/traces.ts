import {
  TILE,
  drawRecipe,
  kindNamed,
  tileHash,
  tilePlant,
  featureAt,
  type Item,
  type Place,
  type Recipe,
} from '@explore/core';
import { SPECIES_SEEDS, spriteCanvas, type DrawnSprite } from './features.ts';
import type { Rect } from './sheets.ts';

/** Kinds build a fresh recipe object per call, so the cache keys on its contents. */
const drawn = new Map<string, DrawnSprite>();

export function recipeSprite(recipe: Recipe, seed: number): DrawnSprite {
  const key = JSON.stringify([recipe, seed]);
  let entry = drawn.get(key);
  if (!entry) {
    const sprite = drawRecipe(recipe, seed);
    entry = { canvas: spriteCanvas(sprite), sprite };
    drawn.set(key, entry);
  }
  return entry;
}

/** A trace ready to draw, anchored bottom-centre on its tile like a feature. */
export type TraceSprite = {
  readonly image: CanvasImageSource;
  readonly src: Rect;
  readonly dx: number;
  readonly dy: number;
  readonly sortY: number;
};

/** Salt for the per-tile seed, apart from the feature indices the generator's art uses. */
const TRACE_SALT = 97;

export function traceSprites(place: Place, now: number): TraceSprite[] {
  const { screen } = place;
  return [...place.traces.values()].flatMap((trace) => {
    const { tx, ty } = trace;
    const ground = {
      feature: featureAt(screen, tx, ty),
      plant: tilePlant(screen, tx, ty)?.species,
    };
    const { recipe } = kindNamed(trace.kind).look(trace, ground, now);
    if (!recipe) return [];
    const seed = tileHash(screen.coord, tx, ty, TRACE_SALT) % SPECIES_SEEDS;
    const { canvas, sprite } = recipeSprite(recipe, seed);
    const bottom = (ty + 1) * TILE;
    return [
      {
        image: canvas,
        src: { x: 0, y: 0, w: sprite.width, h: sprite.height },
        dx: tx * TILE + TILE / 2 - sprite.anchor.x,
        dy: bottom - sprite.anchor.y,
        sortY: bottom,
      },
    ];
  });
}

const icons = new Map<string, HTMLCanvasElement>();

/** An item's icon centred on a transparent tile, drawn once per item. */
export function itemIcon(item: Item): HTMLCanvasElement {
  const key = JSON.stringify(item);
  let icon = icons.get(key);
  if (!icon) {
    const { canvas, sprite } = recipeSprite(kindNamed(item.kind).carry!.icon(item.variant), 0);
    icon = document.createElement('canvas');
    icon.width = TILE;
    icon.height = TILE;
    icon
      .getContext('2d')!
      .drawImage(
        canvas,
        Math.floor((TILE - sprite.width) / 2),
        Math.floor((TILE - sprite.height) / 2),
      );
    icons.set(key, icon);
  }
  return icon;
}
