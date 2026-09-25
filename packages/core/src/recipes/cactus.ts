import type { RampName } from '../palette.ts';
import type { Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { TILE } from '../world.ts';
import { Canvas, ramp, spread, type Ramp } from './draw.ts';

export type CactusParams = {
  readonly skin: RampName;
  /** Sprite height in tiles. */
  readonly tiles: 1 | 2;
  /** The most arms a plant grows. */
  readonly arms: number;
};

/** A vertical stem in fixed light steps: lit left, ribbed middle, shaded right, rounded cap. */
function column(c: Canvas, skin: Ramp, x0: number, width: number, top: number, bottom: number) {
  const L = skin.length - 1;
  for (let y = top; y <= bottom; y++) {
    for (let i = 0; i < width; i++) {
      if (y === top && (i === 0 || i === width - 1) && width > 2) continue;
      const t = i / Math.max(1, width - 1);
      let k = t < 0.3 ? L - 1 : t < 0.7 ? L - 2 : L - 3;
      if (width >= 5 && i % 2 === 1 && i < width - 1) k -= 1;
      if (i === width - 1 && width > 2) k = L - 4;
      if (y <= top + 1 && t < 0.7) k += 1;
      c.set(x0 + i, y, skin[Math.max(0, Math.min(L, k))]!);
    }
  }
}

export function cactus(p: CactusParams, rng: Rng): Sprite {
  const height = p.tiles * TILE;
  const skin = spread(ramp(p.skin), 5);
  const c = new Canvas(TILE, height);
  const ground = height - 2;
  const tall = p.tiles === 2;
  const trunkW = (tall ? 4 : 3) + Math.floor(rng() * 3);
  const tx = Math.round(TILE / 2 - trunkW / 2 + (rng() - 0.5));
  const trunkTop = tall ? 2 + Math.floor(rng() * 6) : 3 + Math.floor(rng() * 4);
  const count = Math.min(p.arms, rng() < 0.15 ? 0 : rng() < 0.55 ? 2 : 1 + Math.floor(rng() * 2));
  const sides = count >= 2 ? [-1, 1] : [rng() < 0.5 ? -1 : 1];
  for (const side of sides.slice(0, count)) {
    const wantW = trunkW >= 5 && rng() < 0.6 ? 3 : 2 + Math.floor(rng() * 2);
    const room = side < 0 ? tx - 1 : TILE - 1 - (tx + trunkW);
    const armW = Math.min(wantW, room - 1);
    if (armW < 2) continue;
    const gap = Math.min(room - armW, 1 + Math.floor(rng() * (tall ? 3 : 2)));
    const elbowY = tall
      ? trunkTop + 9 + Math.floor(rng() * (ground - trunkTop - 14))
      : trunkTop + 4 + Math.floor(rng() * 3);
    const armTop = Math.max(
      trunkTop + 1,
      elbowY - (tall ? 4 : 2) - Math.floor(rng() * (tall ? 7 : 3)),
    );
    const ax = side < 0 ? tx - gap - armW : tx + trunkW + gap;
    const elbowH = Math.min(3, armW);
    const from = side < 0 ? ax + 1 : tx + trunkW;
    const to = side < 0 ? tx : ax + armW - 1;
    for (let y = elbowY - elbowH + 1; y <= elbowY; y++) {
      const rank = elbowY - y;
      for (let x = from; x < to; x++)
        c.set(x, y, skin[rank === elbowH - 1 ? 3 : rank === 0 ? 1 : 2]!);
    }
    column(c, skin, ax, armW, armTop, elbowY);
    c.set(side < 0 ? ax : ax + armW - 1, elbowY, null);
  }
  column(c, skin, tx, trunkW, trunkTop, ground);
  c.outline();
  c.shadow(TILE / 2, height - 0.8, trunkW / 2 + 2, 1.2);
  return c.toSprite();
}
