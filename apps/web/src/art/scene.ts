import { TILE, type Dir, type Screen } from '@explore/core';
import { featureSprites, type PlacedSprite } from './features.ts';
import {
  butterflies,
  butterflyAt,
  fishAt,
  fishes,
  petalsAt,
  twinkleFill,
  twinkles,
  type Butterfly,
  type Fish,
  type PetalSource,
  type Twinkle,
} from './life.ts';
import type { Art } from './load.ts';
import { cell } from './sheets.ts';
import { bakeTerrain, TERRAIN_ART } from './terrain.ts';
import { gust, rustle, swaySlices } from './wind.ts';

/** Everything about a screen that is worked out once and then drawn every frame. */
export type Scene = {
  readonly screen: Screen;
  readonly terrain: HTMLCanvasElement;
  readonly features: readonly PlacedSprite[];
  readonly twinkles: readonly Twinkle[];
  readonly butterflies: readonly Butterfly[];
  readonly fish: readonly Fish[];
  readonly petalSources: readonly PetalSource[];
};

/** Something the game draws in y order among the features, such as a player. */
export type Actor = {
  readonly x: number;
  readonly y: number;
  readonly moving: boolean;
  readonly sortY: number;
  draw(): void;
};

export function buildScene(screen: Screen, art: Art): Scene {
  const features = featureSprites(screen, art);
  return {
    screen,
    terrain: bakeTerrain(screen, art),
    features,
    twinkles: twinkles(screen),
    butterflies: butterflies(screen),
    fish: fishes(screen),
    petalSources: features
      .filter((f) => f.variant.sheds)
      .map((f) => ({
        x: f.dx + 6,
        y: f.dy + f.src.h - 14,
        w: f.src.w - 12,
        seed: f.tx * 31 + f.ty,
      })),
  };
}

const PETAL = { sheet: 'petal', w: 12, h: 7 } as const;
const FISH_TOP_DOWN = cell('fish', 1, 0);
const FISH_SHADOW = '#2f6f8f';
const FISH_TURN: Record<Dir, number> = { s: 0, w: Math.PI / 2, n: Math.PI, e: -Math.PI / 2 };

const BUTTERFLY_FRAMES = [
  ['OO...OO', 'OWO.OWO', 'OWWBWWO', '.OWBWO.', '..OBO..'],
  ['..O.O..', '.OWBWO.', '.OWBWO.', '..OBO..', '...O...'],
] as const;
const BUTTERFLY_WINGS = ['#fff4dd', '#f1c40f', '#e67e22', '#7fc4e8'];
const BUTTERFLY_BODY = '#2e3939';
const BUTTERFLY_OUTLINE = '#141b1b';

const fishShadows = new WeakMap<Art, HTMLCanvasElement>();

function fishShadow(art: Art): HTMLCanvasElement {
  let canvas = fishShadows.get(art);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = TILE;
    canvas.height = TILE;
    const ctx = canvas.getContext('2d')!;
    const { rect } = FISH_TOP_DOWN;
    ctx.drawImage(art.sheets.fish, rect.x, rect.y, rect.w, rect.h, 0, 0, TILE, TILE);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = FISH_SHADOW;
    ctx.fillRect(0, 0, TILE, TILE);
    fishShadows.set(art, canvas);
  }
  return canvas;
}

function drawFeature(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  f: PlacedSprite,
  clock: number,
  motion: boolean,
  actors: readonly Actor[],
) {
  const { image, src, dx, dy, variant } = f;
  if (motion && variant.frames) {
    const frame = Math.floor(clock * 5 + f.phase * variant.frames) % variant.frames;
    ctx.drawImage(image, src.x + frame * src.w, src.y, src.w, src.h, dx, dy, src.w, src.h);
    return;
  }
  if (!motion || !variant.sway) {
    ctx.drawImage(image, src.x, src.y, src.w, src.h, dx, dy, src.w, src.h);
    return;
  }
  const trampled =
    f.feature === 'tallgrass' &&
    actors.some(
      (a) => a.moving && Math.floor(a.x / TILE) === f.tx && Math.floor(a.y / TILE) === f.ty,
    );
  const lean = trampled
    ? rustle(clock + f.phase)
    : gust(scene.screen.coord, dx + src.w / 2, clock + f.phase * 0.4);
  for (const slice of swaySlices(src.h, variant.sway, lean)) {
    ctx.drawImage(
      image,
      src.x,
      src.y + slice.y,
      src.w,
      slice.h,
      dx + slice.dx,
      dy + slice.y,
      src.w,
      slice.h,
    );
  }
}

/** Draws one frame. With `motion` off everything holds still and nothing flies or swims. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  art: Art,
  clock: number,
  actors: readonly Actor[],
  motion: boolean,
): void {
  ctx.drawImage(scene.terrain, 0, 0);

  if (motion) {
    for (const tw of scene.twinkles) {
      const fill = twinkleFill(tw, clock);
      if (fill === undefined) continue;
      const { sheet, rect } = TERRAIN_ART.water.fills[fill]!;
      ctx.drawImage(
        art.sheets[sheet],
        rect.x,
        rect.y,
        TILE,
        TILE,
        tw.tx * TILE,
        tw.ty * TILE,
        TILE,
        TILE,
      );
    }
    const shadow = fishShadow(art);
    for (const fish of scene.fish) {
      const at = fishAt(fish, clock);
      if (!at) continue;
      ctx.save();
      ctx.globalAlpha = 0.45 * at.alpha;
      ctx.translate(at.x, at.y);
      ctx.rotate(FISH_TURN[at.dir]);
      ctx.drawImage(shadow, -TILE / 2, -TILE / 2);
      ctx.restore();
    }
  }

  const drawables = [
    ...scene.features.map((f) => ({
      sortY: f.sortY,
      draw: () => drawFeature(ctx, scene, f, clock, motion, actors),
    })),
    ...actors,
  ].sort((a, b) => a.sortY - b.sortY);
  for (const d of drawables) d.draw();

  if (!motion) return;

  const petalSheet = art.sheets[PETAL.sheet];
  for (const p of petalsAt(scene.petalSources, clock, (x) => gust(scene.screen.coord, x, clock))) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.drawImage(
      petalSheet,
      p.frame * PETAL.w,
      0,
      PETAL.w,
      PETAL.h,
      p.x - PETAL.w / 2,
      p.y,
      PETAL.w,
      PETAL.h,
    );
    ctx.restore();
  }

  for (const bf of scene.butterflies) {
    const { x, y, frame } = butterflyAt(bf, clock);
    const rows = BUTTERFLY_FRAMES[frame];
    rows.forEach((row, ry) => {
      [...row].forEach((px, rx) => {
        if (px === '.') return;
        ctx.fillStyle =
          px === 'B' ? BUTTERFLY_BODY : px === 'O' ? BUTTERFLY_OUTLINE : BUTTERFLY_WINGS[bf.color]!;
        ctx.fillRect(x - 3 + rx, y - 2 + ry, 1, 1);
      });
    });
  }
}
