import type { RampName } from '../palette.ts';
import type { Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { TILE } from '../world.ts';
import { Canvas, ramp } from './draw.ts';

export type SignpostParams = {
  readonly wood: RampName;
};

const HEIGHT = 2 * TILE;
const FOOT = HEIGHT - 3;
/** A little taller than a player, so a sign reads as a landmark rather than a prop. */
const BOARD_TOP = FOOT - 15;
const BOARD_ROWS = 5;

/** A post with a board carved with a name: a plank, or an arrow pointing either way. */
export function signpost(p: SignpostParams, rng: Rng): Sprite {
  const c = new Canvas(TILE, HEIGHT);
  const r = ramp(p.wood);
  const n = r.length;
  const wood = { light: r[n - 1]!, lit: r[n - 2]!, shaded: r[n - 3]!, dark: r[n - 4]! };

  for (let y = BOARD_TOP + BOARD_ROWS; y <= FOOT; y++) {
    c.set(7, y, wood.lit);
    c.set(8, y, wood.shaded);
  }

  const point = [0, -1, 1][Math.floor(rng() * 3)]!;
  const x0 = point < 0 ? 4 : 2;
  const x1 = point > 0 ? 11 : 13;
  const bottom = BOARD_TOP + BOARD_ROWS - 1;
  for (let y = BOARD_TOP; y <= bottom; y++) {
    const colour = y === BOARD_TOP ? wood.light : y === bottom ? wood.shaded : wood.lit;
    for (let x = x0; x <= x1; x++) c.set(x, y, x === x1 && point <= 0 ? wood.shaded : colour);
  }
  if (point !== 0) {
    const tip = point > 0 ? x1 + 1 : x0 - 1;
    for (let k = 0; k < 2; k++) {
      const x = tip + point * k;
      for (let y = BOARD_TOP + k; y <= bottom - k; y++) c.set(x, y, wood.shaded);
    }
  }

  for (const y of [BOARD_TOP + 1, BOARD_TOP + 3]) {
    let x = x0 + 1 + Math.floor(rng() * 2);
    while (x < x1 - 1) {
      const run = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < run && x < x1 - 1; i++, x++) c.set(x, y, wood.dark);
      x += 1;
    }
  }

  c.outline();
  c.shadow(8, HEIGHT - 1.8, 3, 1);
  return c.toSprite();
}
