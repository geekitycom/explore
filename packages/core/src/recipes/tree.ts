import type { RampName } from '../palette.ts';
import { TILE } from '../world.ts';
import type { Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { Canvas, Mask, clamp, ramp, spread, step, type Ramp } from './draw.ts';

export type TreeParams = {
  /** Broadleaf: a flat-topped canopy in slanted light bands. Conifer: tiered skirts. */
  readonly shape: 'broadleaf' | 'conifer';
  readonly leaves: RampName;
  readonly bark: RampName;
  /** Sprite height in tiles. */
  readonly tiles: 2 | 3;
  /** Canopy half-width in pixels, 6 to 15. */
  readonly spread: number;
  /** Bare trunk in pixels between the canopy and the ground. */
  readonly trunk: number;
};

const WIDTH = 2 * TILE;
const CX = WIDTH / 2;

/** The ground line: trunks stop here, with the outline and shadow below. */
const groundY = (height: number) => height - 3;

function drawTrunk(
  c: Canvas,
  rng: Rng,
  bark: Ramp,
  { top, bottom, width }: { top: number; bottom: number; width: number },
) {
  const [dark, mid, light] = spread(bark, 3, 1);
  const x0 = Math.round(CX - width / 2);
  const x1 = x0 + width - 1;
  for (let y = top; y <= bottom; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / Math.max(1, x1 - x0);
      c.set(x, y, t < 0.3 ? light! : t < 0.7 ? mid! : dark!);
    }
  }
  // Roots: the trunk flares on the bottom rows, unevenly, darker on the shaded right.
  const left = 1 + Math.floor(rng() * 2);
  const right = 1 + Math.floor(rng() * 2);
  for (let x = x0 - left; x < x0; x++) c.set(x, bottom, mid!);
  for (let x = x1 + 1; x <= x1 + right; x++) c.set(x, bottom, dark!);
  if (left > 1) c.set(x0 - 1, bottom - 1, mid!);
  if (right > 1) c.set(x1 + 1, bottom - 1, dark!);
}

/** Lighter drips hanging over one band edge: irregular runs of 1-2px strokes, 0-3px long. */
function drips(rng: Rng): number[] {
  const out: number[] = [];
  while (out.length < WIDTH) {
    const gap = 1 + Math.floor(rng() * rng() * 5);
    for (let i = 0; i < gap; i++) out.push(0);
    const len = 1 + Math.floor(rng() * rng() * 4);
    const wide = rng() < 0.35 ? 2 : 1;
    for (let i = 0; i < wide; i++) out.push(i === 1 && len > 1 ? len - 1 : len);
  }
  return out;
}

function broadleaf(p: TreeParams, rng: Rng, height: number): Canvas {
  const c = new Canvas(WIDTH, height);
  const leaves = ramp(p.leaves).slice(0, 4);
  const ground = groundY(height);
  const rx = clamp(p.spread + (rng() - 0.6) * 3, 5, 15);
  const bottom = ground - p.trunk - Math.floor(rng() * 3);
  const ry = Math.min((bottom - 1) / 2, rx * 0.8 + (rng() - 0.5) * 2);
  const cy = bottom - ry;
  const cx = CX + (rng() - 0.5);
  drawTrunk(c, rng, ramp(p.bark), {
    top: Math.floor(cy),
    bottom: ground,
    width: rx > 9 ? 4 + Math.floor(rng() * 2) : 3,
  });

  const mask = new Mask(WIDTH, height);
  const n = 2.2 + rng() * 0.9;
  const wobble = 0.6 + rng() * 1.4;
  const lobes = 5 + Math.floor(rng() * 3);
  const phase = [rng() * 6.28, rng() * 6.28];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const a = Math.atan2(dy, dx);
      const bump =
        1 +
        wobble *
          (0.045 * Math.sin(a * lobes + phase[0]!) + 0.03 * Math.sin(a * (lobes + 3) + phase[1]!));
      if (mask.interior(x, y) && Math.abs(dx) ** n + Math.abs(dy) ** n <= bump) mask.add(x, y);
    }
  }
  mask.smooth();
  const { top, bottom: maskBottom } = mask.bounds();
  const span = maskBottom - top + 1;
  const b0 = 0.4 + rng() * 0.1;
  const bands = [b0, b0 + 0.22 + rng() * 0.06, 0.86 + rng() * 0.05];
  const edges = bands.map(() => drips(rng));
  const lightest = leaves.length - 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!mask.has(x, y)) continue;
      const t = (y - top) / span + ((x + 0.5 - cx) / rx) * 0.12;
      let k = 0;
      bands.forEach((b, i) => {
        if (t >= b + (edges[i]![x] ?? 0) / span) k = i + 1;
      });
      c.set(x, y, leaves[Math.max(0, lightest - k)]!);
    }
  }
  // Leaf-clump marks: short dark smiles in the upper bands.
  const marks = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < marks; i++) {
    const mx = Math.round(cx - rx * 0.6 + rng() * rx * 1.1);
    const my = Math.round(top + span * (0.15 + rng() * 0.45));
    const base = c.get(mx + 1, my + 1);
    const idx = base ? leaves.indexOf(base) : -1;
    if (idx <= 0) continue;
    for (const [ox, oy] of [
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 0],
    ] as const) {
      if (mask.has(mx + ox, my + oy) && c.get(mx + ox, my + oy) === base) {
        c.set(mx + ox, my + oy, leaves[idx - 1]!);
      }
    }
  }
  c.despeckle();
  c.shadow(CX, ground + 1.5, Math.min(rx * 0.75, 11), 2.5);
  return c;
}

function conifer(p: TreeParams, rng: Rng, height: number): Canvas {
  const c = new Canvas(WIDTH, height);
  const needles = ramp(p.leaves).slice(-4);
  const ground = groundY(height);
  const top = 1 + Math.floor(rng() * 2);
  const base = ground - p.trunk;
  const tiers = Math.max(3, Math.round((base - top) / 6.5) + Math.floor(rng() * 3) - 1);
  const width = clamp(p.spread + (rng() - 0.5) * 3, 5, 15);
  drawTrunk(c, rng, ramp(p.bark), { top: base - 2, bottom: ground, width: width > 9 ? 4 : 3 });
  const tierH = (base - top) / tiers;
  for (let t = 0; t < tiers; t++) {
    const y0 = top + t * tierH * 0.9;
    const y1 = top + (t + 1) * tierH + 1.5;
    const halfW = 3 + ((t + 1) / tiers) * (width - 3) + (rng() - 0.5);
    const tips = 2 + Math.floor(halfW / (2.6 + rng() * 1.2));
    const phase = rng();
    for (let y = Math.floor(y0); y <= Math.ceil(y1) + 1; y++) {
      const ty = (y - y0) / (y1 - y0);
      const hw = t === 0 ? Math.max(0.6, halfW * ty) : 1.5 + (halfW - 1.5) * Math.min(1, ty * 1.05);
      for (
        let x = Math.max(1, Math.floor(CX - hw - 1));
        x <= Math.min(WIDTH - 2, Math.ceil(CX + hw));
        x++
      ) {
        const fx = (x + 0.5 - CX) / hw;
        if (Math.abs(fx) > 1) continue;
        const hem =
          y1 + 1.2 * Math.abs(Math.sin((fx * tips + phase) * Math.PI)) - 1.4 + Math.abs(fx) * 1.2;
        if (y > hem) continue;
        const up = (y - y0) / (y1 - y0);
        let v = 0.55 - fx * 0.4 - up * 0.25 - (t / tiers) * 0.08;
        if (y > hem - 1.2) v -= 0.25;
        if (up < 0.25 && fx < 0.2) v += 0.2;
        c.set(x, y, step(needles, clamp(v, 0, 0.999)));
      }
    }
  }
  c.despeckle();
  c.shadow(CX, ground + 1.5, Math.min(width * 0.7, 9), 2.2);
  return c;
}

export function tree(p: TreeParams, rng: Rng): Sprite {
  const height = p.tiles * TILE;
  const c = p.shape === 'broadleaf' ? broadleaf(p, rng, height) : conifer(p, rng, height);
  c.outline();
  return c.toSprite();
}
