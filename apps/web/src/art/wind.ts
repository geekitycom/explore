import { SCREEN_PX_W, type ScreenCoord } from '@explore/core';

const GUST_PERIOD_S = 5;
const GUST_WAVELENGTH_PX = 420;
/** How much of each period the gust leans the plants over. */
const LEAN = 0.55;

/**
 * Wind lean at a world x: 0 at rest, up to 1 as a gust passes. Keyed to world position so a
 * gust rolls on across a seam instead of restarting on the next screen.
 */
export function gust(coord: ScreenCoord, x: number, clock: number): number {
  const worldX = coord.sx * SCREEN_PX_W + x;
  const phase = clock / GUST_PERIOD_S - worldX / GUST_WAVELENGTH_PX;
  const wave = Math.sin(2 * Math.PI * phase);
  const breeze = 0.35 * Math.sin(2 * Math.PI * (clock / 1.7 + worldX / 97));
  return Math.max(-0.3, Math.min(1, (wave - (1 - LEAN)) / LEAN + breeze * 0.4));
}

/** Pixel offset for a sway band `level` rows up (1 = lowest moving band). Always -1, 0, or 1. */
export function bandOffset(lean: number, level: number, bands: number): -1 | 0 | 1 {
  const reach = (lean * level) / bands;
  return reach > 0.5 ? 1 : reach < -0.5 ? -1 : 0;
}

export type Sway = {
  /** Rows at the bottom of the sprite that never move (trunk, stem, base). */
  readonly still: number;
  /** Number of equal bands the rows above are split into; higher bands lean further. */
  readonly bands: number;
};

export type Slice = { readonly y: number; readonly h: number; readonly dx: -1 | 0 | 1 };

/** Horizontal slices of a sprite `height` tall, top first, with how far each shifts. */
export function swaySlices(height: number, sway: Sway, lean: number): Slice[] {
  const moving = height - sway.still;
  const slices: Slice[] = [];
  for (let b = 0; b < sway.bands; b++) {
    const top = Math.round((moving * b) / sway.bands);
    const bottom = Math.round((moving * (b + 1)) / sway.bands);
    slices.push({ y: top, h: bottom - top, dx: bandOffset(lean, sway.bands - b, sway.bands) });
  }
  slices.push({ y: moving, h: sway.still, dx: 0 });
  return slices.filter((s) => s.h > 0);
}

/** A quick shiver for grass someone is walking through. */
export function rustle(clock: number): -1 | 1 {
  return Math.floor(clock * 12) % 2 === 0 ? -1 : 1;
}
