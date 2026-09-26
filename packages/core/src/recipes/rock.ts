import type { RampName } from '../palette.ts';
import type { Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { TILE } from '../world.ts';
import { Canvas, Mask, ramp } from './draw.ts';

export type RockParams = {
  readonly stone: RampName;
  /** Moss or lichen patches on the lit top. */
  readonly moss?: RampName;
  /** 0 for a pebble-sized stone, 1 for a boulder filling its tile. */
  readonly size: number;
};

/** A convex polygon from jittered angles, squared off below so it sits on the ground. */
function outlineOf(rng: Rng, cx: number, cy: number, rx: number, ry: number) {
  const n = 7 + Math.floor(rng() * 3);
  return Array.from({ length: n }, (_, i) => {
    const a = ((i + 0.2 + rng() * 0.6) / n) * Math.PI * 2;
    const r = 0.88 + rng() * 0.16;
    const bx = Math.cos(a);
    const by = Math.sin(a);
    const sq = by > 0 ? 0.45 : 0.15;
    return [
      cx + (bx + Math.sign(bx) * sq * (1 - Math.abs(bx))) * rx * r * 0.9,
      cy + Math.min(1, by + Math.sign(by) * sq * (1 - Math.abs(by))) * ry * r,
    ] as const;
  });
}

function inside(verts: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const [xi, yi] = verts[i]!;
    const [xj, yj] = verts[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

export function rock(p: RockParams, rng: Rng): Sprite {
  const { canvas, rx } = rockBody(p, rng);
  canvas.outline();
  canvas.shadow(TILE / 2 + 0.5, TILE - 0.8, rx + 1, 1.2);
  return canvas.toSprite();
}

/** The rock's lit and shaded pixels on its tile, with no outline or shadow yet. */
export function rockBody(p: RockParams, rng: Rng): { canvas: Canvas; rx: number } {
  const stone = ramp(p.stone);
  const L = stone.length - 1;
  const c = new Canvas(TILE, TILE);
  const scale = 0.6 + 0.4 * p.size;
  const rx = (5 + rng() * 1.6) * scale;
  const ry = (4.4 + rng() * 1.4) * scale;
  const cx = TILE / 2 + (rng() - 0.5);
  const cy = TILE - 1.4 - ry;
  const verts = outlineOf(rng, cx, cy, rx, ry);
  const mask = new Mask(TILE, TILE);
  for (let y = 0; y < TILE - 1; y++) {
    for (let x = 1; x < TILE - 1; x++) if (inside(verts, x + 0.5, y + 0.5)) mask.add(x, y);
  }
  mask.smooth();
  const { top, bottom, left, right } = mask.bounds();
  const hh = bottom - top + 1;
  const ww = right - left + 1;
  const capDepth = hh * (0.38 + rng() * 0.12);
  const capEdge = (x: number) =>
    top + capDepth * (0.7 + 0.3 * Math.sin(((x + 0.5 - left) / ww) * Math.PI));

  // Cracks run down the front face from the lip: none, one, or two, placed and bent per seed.
  const cracks = new Set<number>();
  const count = rng() < 0.2 ? 0 : rng() < 0.65 ? 1 : 2;
  for (let i = 0; i < count; i++) {
    let x = Math.round(left + ww * (0.25 + rng() * 0.55));
    const bend = rng() < 0.5 ? -1 : 1;
    const length = 2 + Math.floor(rng() * Math.max(1, hh - capDepth - 2));
    for (let y = Math.floor(capEdge(x)) + 1, k = 0; k < length && y < bottom - 1; y++, k++) {
      cracks.add(y * TILE + x);
      if (k === 1 && rng() < 0.6) x += bend;
    }
  }

  const moss = p.moss ? ramp(p.moss) : undefined;
  const mossAt = new Set<number>();
  if (moss) {
    const patches = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < patches; i++) {
      const mx = left + 1 + Math.floor(rng() * Math.max(1, ww * 0.6));
      const my = top;
      const w = 2 + Math.floor(rng() * 3);
      for (let dx = 0; dx < w; dx++) {
        const drop = dx === 0 || dx === w - 1 ? 1 : 2;
        for (let dy = 0; dy < drop; dy++) mossAt.add((my + dy) * TILE + mx + dx);
      }
    }
  }

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (!mask.has(x, y)) continue;
      const u = (x + 0.5 - left) / ww;
      const edge = capEdge(x);
      let k: number;
      if (y < edge) k = u < 0.55 && y < top + capDepth * 0.5 ? L : L - 1;
      else k = u < 0.12 ? L - 1 : L - 2;
      if (y >= bottom && y >= edge) k = Math.min(k, L - 3);
      if (y >= bottom - 2 && y >= edge && u > 0.7) k = Math.min(k, L - 3);
      if (y === Math.floor(edge) && u > 0.15 && u < 0.85) k = L - 3;
      if (cracks.has(y * TILE + x)) k = L - 3;
      let colour = stone[Math.max(0, k)]!;
      if (moss && y < edge && mossAt.has(y * TILE + x)) {
        colour = moss[u < 0.5 && y === top ? moss.length - 1 : moss.length - 2]!;
      }
      c.set(x, y, colour);
    }
  }
  c.despeckle();
  return { canvas: c, rx };
}
