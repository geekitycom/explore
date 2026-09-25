import {
  LATTICE_H,
  LATTICE_W,
  SCREEN_H,
  SCREEN_PX_H,
  SCREEN_PX_W,
  SCREEN_W,
  TILE,
  clamp,
  cornerAt,
  featureAt,
  type Dir,
  type Screen,
} from '@explore/core';
import { tileHash } from './sheets.ts';
import { TERRAIN_ART, fillIndex } from './terrain.ts';

const unit = (h: number) => (h >>> 8) / 0x1000000;

/** A tile whose whole 3x3 neighbourhood is water, so animating it can never touch a shore. */
export function isOpenWater(screen: Screen, tx: number, ty: number): boolean {
  for (let cy = ty - 1; cy <= ty + 2; cy++) {
    for (let cx = tx - 1; cx <= tx + 2; cx++) {
      const x = Math.min(Math.max(cx, 0), LATTICE_W - 1);
      const y = Math.min(Math.max(cy, 0), LATTICE_H - 1);
      if (cornerAt(screen, x, y) !== 'water') return false;
    }
  }
  return true;
}

export type Twinkle = { readonly tx: number; readonly ty: number; readonly phase: number };

const TWINKLE_PERIOD_S = 3.2;
/** Water fill variants a twinkling tile cycles through, by index into TERRAIN_ART.water.fills. */
const TWINKLE_CYCLE = [
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  2,
  1,
  undefined,
] as const;

export function twinkles(screen: Screen): Twinkle[] {
  const list: Twinkle[] = [];
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      if (!isOpenWater(screen, tx, ty) || fillIndex(screen, tx, ty, TERRAIN_ART.water) !== 0)
        continue;
      const h = tileHash(screen.coord, tx, ty, 101);
      if (unit(h) < 0.25) list.push({ tx, ty, phase: unit(tileHash(screen.coord, tx, ty, 102)) });
    }
  }
  return list;
}

/** Which water fill variant a twinkling tile shows now, or undefined for the plain baked water. */
export function twinkleFill({ phase }: Twinkle, clock: number): 1 | 2 | undefined {
  const t = (clock / TWINKLE_PERIOD_S + phase) % 1;
  return TWINKLE_CYCLE[Math.floor(t * TWINKLE_CYCLE.length)];
}

export type Butterfly = {
  readonly hx: number;
  readonly hy: number;
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly color: number;
};

const MAX_BUTTERFLIES = 3;

export function butterflies(screen: Screen): Butterfly[] {
  const flowers: [number, number][] = [];
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++)
      if (featureAt(screen, tx, ty) === 'flowers') flowers.push([tx, ty]);
  }
  if (flowers.length < 2) return [];
  const count = Math.min(MAX_BUTTERFLIES, Math.ceil(flowers.length / 8));
  return Array.from({ length: count }, (_, i) => {
    const h = tileHash(screen.coord, i, 0, 201);
    const [tx, ty] = flowers[h % flowers.length]!;
    const r = (salt: number) => unit(tileHash(screen.coord, i, salt, 202)) * 2 * Math.PI;
    return { hx: tx * TILE + TILE / 2, hy: ty * TILE, a: r(1), b: r(2), c: r(3), color: h % 4 };
  });
}

export function butterflyAt(bf: Butterfly, clock: number): { x: number; y: number; frame: 0 | 1 } {
  const t = clock;
  const x = bf.hx + 22 * Math.sin(0.6 * t + bf.a) + 7 * Math.sin(1.7 * t + bf.b);
  const y = bf.hy - 12 + 9 * Math.sin(0.9 * t + bf.c) + 4 * Math.sin(2.3 * t + bf.a);
  return {
    x: Math.round(clamp(x, 4, SCREEN_PX_W - 4)),
    y: Math.round(clamp(y, 4, SCREEN_PX_H - 4)),
    frame: Math.floor(t * 9 + bf.a * 10) % 2 === 0 ? 0 : 1,
  };
}

/** A fish swims back and forth along a straight run of open-water tiles. */
export type Fish = {
  readonly axis: 'x' | 'y';
  /** Tile index across the run (row for 'x', column for 'y'). */
  readonly lane: number;
  readonly from: number;
  readonly to: number;
  readonly phase: number;
};

const MIN_RUN = 4;
const MAX_FISH = 2;
const FISH_PERIOD_S = 11;
const FISH_SWIM_S = 6;
const FISH_FADE_S = 0.8;

function runs(screen: Screen, axis: 'x' | 'y'): Omit<Fish, 'phase'>[] {
  const found: Omit<Fish, 'phase'>[] = [];
  const lanes = axis === 'x' ? SCREEN_H : SCREEN_W;
  const length = axis === 'x' ? SCREEN_W : SCREEN_H;
  for (let lane = 0; lane < lanes; lane++) {
    let start = -1;
    for (let i = 0; i <= length; i++) {
      const open =
        i < length && isOpenWater(screen, axis === 'x' ? i : lane, axis === 'x' ? lane : i);
      if (open && start < 0) start = i;
      if (!open && start >= 0) {
        if (i - start >= MIN_RUN) found.push({ axis, lane, from: start, to: i - 1 });
        start = -1;
      }
    }
  }
  return found;
}

export function fishes(screen: Screen): Fish[] {
  const all = [...runs(screen, 'x'), ...runs(screen, 'y')];
  const chosen: Fish[] = [];
  for (let i = 0; i < all.length && chosen.length < MAX_FISH; i++) {
    const run = all[tileHash(screen.coord, i, 0, 301) % all.length]!;
    if (chosen.some((f) => f.axis === run.axis && f.lane === run.lane)) continue;
    chosen.push({ ...run, phase: unit(tileHash(screen.coord, i, 1, 302)) * FISH_PERIOD_S });
  }
  return chosen;
}

export function fishAt(
  fish: Fish,
  clock: number,
): { x: number; y: number; dir: Dir; alpha: number } | undefined {
  const cycle = Math.floor((clock + fish.phase) / FISH_PERIOD_S);
  const age = (clock + fish.phase) % FISH_PERIOD_S;
  if (age > FISH_SWIM_S) return undefined;
  const forward = cycle % 2 === 0;
  const p = age / FISH_SWIM_S;
  const along =
    (forward ? fish.from + (fish.to - fish.from) * p : fish.to - (fish.to - fish.from) * p) * TILE +
    TILE / 2;
  const across = fish.lane * TILE + TILE / 2;
  const alpha = Math.min(1, age / FISH_FADE_S, (FISH_SWIM_S - age) / FISH_FADE_S);
  const dir: Dir = fish.axis === 'x' ? (forward ? 'e' : 'w') : forward ? 's' : 'n';
  return fish.axis === 'x'
    ? { x: Math.round(along), y: across, dir, alpha }
    : { x: across, y: Math.round(along), dir, alpha };
}

/** Where a cherry tree drops petals from: its canopy, in screen pixels. */
export type PetalSource = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly seed: number;
};

const PETALS_PER_TREE = 2;
const PETAL_PERIOD_S = 5;
const PETAL_LIFE_S = 3.4;
const PETAL_FRAMES = 6;

export function petalsAt(
  sources: readonly PetalSource[],
  clock: number,
  lean: (x: number) => number,
): { x: number; y: number; frame: number; alpha: number }[] {
  return sources.flatMap((src) =>
    Array.from({ length: PETALS_PER_TREE }, (_, k) => k).flatMap((k) => {
      const offset = unit(Math.imul(src.seed + k * 7919, 0x9e3779b1) >>> 0) * PETAL_PERIOD_S;
      const age = (clock + offset) % PETAL_PERIOD_S;
      if (age > PETAL_LIFE_S) return [];
      const startX =
        src.x +
        unit(
          Math.imul(
            src.seed + k * 104729 + Math.floor((clock + offset) / PETAL_PERIOD_S),
            0x85ebca6b,
          ) >>> 0,
        ) *
          src.w;
      const drift = 6 + 10 * Math.max(0, lean(startX));
      return [
        {
          x: Math.round(startX + drift * age + 3 * Math.sin(age * 3)),
          y: Math.round(src.y + 9 * age),
          frame: Math.floor(age * 8) % PETAL_FRAMES,
          alpha: Math.min(1, (PETAL_LIFE_S - age) / 0.6),
        },
      ];
    }),
  );
}
