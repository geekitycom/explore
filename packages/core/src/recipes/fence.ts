import { OUTLINE, type Hex, type RampName } from '../palette.ts';
import type { Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { TILE, type Dir, type Fence } from '../world.ts';
import { Canvas, ramp } from './draw.ts';

/** One bit per side a fence piece runs on into the neighbouring tile. */
export const LINK: Readonly<Record<Dir, number>> = { n: 1, e: 2, s: 4, w: 8 };

export type FenceParams = {
  readonly style: Fence;
  /** Boards, bars, or stones. */
  readonly material: RampName;
  readonly broken?: boolean;
  /** LINK bits of the sides that join a neighbour. */
  readonly links: number;
};

type Tones = { readonly light: Hex; readonly lit: Hex; readonly shaded: Hex; readonly dark: Hex };

type Span = readonly [number, number];

/**
 * A fence is a horizontal band, a vertical strip, and a centre piece. Band and strip patterns
 * repeat every 8 pixels and never vary by seed near a joined edge, so pieces meet their
 * neighbours without a seam; wear and damage stay inside INNER.
 */
type Style = {
  /** Columns the band always covers, so a piece with no links still stands. */
  readonly centre: Span;
  /** Columns the vertical strip covers. */
  readonly strip: Span;
  band(c: Canvas, x: number, t: Tones): void;
  along(c: Canvas, y: number, t: Tones): void;
  post?(c: Canvas, t: Tones): void;
  /** Drawn after the outline, for parts drawn in the outline colour. */
  ink?(c: Canvas, cols: Span): void;
  wear(c: Canvas, rng: Rng, t: Tones, cols: Span): void;
  damage(c: Canvas, rng: Rng, t: Tones, cols: Span, links: number): void;
};

const FOOT = TILE - 2;
const INNER: Span = [2, TILE - 3];
const MEET = 8;

const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
const between = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const within = (x: number, [a, b]: Span) => x >= a && x <= b;

/** The part of `cols` inside INNER that the band actually covers, left or right of the centre. */
function side(rng: Rng, cols: Span, centre: Span): Span | undefined {
  const sides: Span[] = [];
  if (cols[0] < centre[0]) sides.push([Math.max(INNER[0], cols[0]), centre[0] - 1]);
  if (cols[1] > centre[1]) sides.push([centre[1] + 1, Math.min(INNER[1], cols[1])]);
  return sides.length ? pick(rng, sides) : undefined;
}

function tones(name: RampName): Tones {
  const r = ramp(name);
  const n = r.length;
  return { light: r[n - 1]!, lit: r[n - 2]!, shaded: r[n - 3]!, dark: r[n - 4]! };
}

const picket: Style = {
  centre: [6, 9],
  strip: [7, 8],
  band(c, x, t) {
    const k = (x - 6 + 8) % 8;
    if (k < 4) {
      const colour = [t.light, t.lit, t.lit, t.shaded][k]!;
      if (k === 1 || k === 2) c.set(x, 3, t.lit);
      for (let y = 4; y < FOOT; y++) c.set(x, y, colour);
      c.set(x, FOOT, t.shaded);
    } else {
      c.set(x, 6, t.shaded);
      c.set(x, 11, t.shaded);
    }
  },
  along(c, y, t) {
    const top = y % 8 === 3 || y % 8 === 4;
    if (top) [6, 9].forEach((x, i) => c.set(x, y, i ? t.shaded : t.light));
    c.set(7, y, t.lit);
    c.set(8, y, t.shaded);
  },
  wear(c, rng, t) {
    const x = between(rng, 6, 9);
    c.set(x, between(rng, 5, 12), x === 9 ? t.dark : t.shaded);
    c.set(between(rng, 7, 8), between(rng, 5, 12), t.light);
  },
  damage(c, rng, t, cols, links) {
    const snap = between(rng, 6, 9);
    const along = (links & (LINK.n | LINK.s)) !== 0;
    for (const x of along ? [pick(rng, [6, 9])] : [6, 7, 8, 9]) {
      const cut = snap + (x % 2 === 0 ? 1 : 0) + (x > 7 ? 1 : 0);
      for (let y = 3; y < cut; y++) c.set(x, y, null);
    }
    const gap = side(rng, cols, picket.centre);
    if (gap) {
      const x = between(rng, gap[0], gap[1]);
      c.set(x, 6, null);
      c.set(x, 11, rng() < 0.5 ? null : t.dark);
    }
  },
};

const splitrail: Style = {
  centre: [6, 9],
  strip: [7, 8],
  band(c, x, t) {
    c.set(x, 6, x % 8 === 2 || x % 8 === 3 ? t.light : t.lit);
    c.set(x, 7, t.shaded);
    c.set(x, 11, x % 8 === 5 ? t.light : t.lit);
    c.set(x, 12, t.shaded);
  },
  along(c, y, t) {
    c.set(7, y, y % 8 === 1 ? t.light : t.lit);
    c.set(8, y, t.shaded);
  },
  post(c, t) {
    for (let y = 3; y <= FOOT; y++) {
      [t.light, t.lit, t.shaded, t.dark].forEach((colour, i) => c.set(6 + i, y, colour));
    }
    c.set(7, 3, t.light);
    c.set(8, 3, t.lit);
  },
  wear(c, rng, t, cols) {
    c.set(7, between(rng, 5, 13), t.shaded);
    c.set(8, between(rng, 5, 13), t.dark);
    const x = between(rng, Math.max(INNER[0], cols[0]), Math.min(INNER[1], cols[1]));
    if (!within(x, splitrail.centre)) c.set(x, pick(rng, [7, 12]), t.dark);
  },
  damage(c, rng, t, cols) {
    const chipped = rng() < 0.5 ? 6 : 9;
    const chip = between(rng, 1, 3);
    for (let y = 3; y < 3 + chip; y++) c.set(chipped, y, null);
    const gap = side(rng, cols, splitrail.centre);
    if (!gap) return;
    const rail = pick(rng, [6, 11]);
    for (let x = gap[0]; x <= gap[1]; x++) {
      c.set(x, rail, null);
      c.set(x, rail + 1, null);
    }
    const from = gap[0] === INNER[0] ? gap[1] : gap[0];
    const dir = from === gap[1] ? -1 : 1;
    for (let k = 0; k < 4 && rail + 2 + k <= FOOT; k++) {
      c.set(from + dir * k, rail + 1 + k, t.lit);
      c.set(from + dir * k, rail + 2 + k, t.shaded);
    }
  },
};

const RAIL_ROWS = [4, 12] as const;

const railing: Style = {
  centre: [7, 8],
  strip: [7, 8],
  band(c, x, t) {
    for (const y of RAIL_ROWS) c.set(x, y, x % 8 === 1 ? t.light : t.lit);
  },
  along(c, y, t) {
    c.set(7, y, t.lit);
    c.set(8, y, t.shaded);
  },
  post(c, t) {
    for (let y = 2; y <= FOOT; y++) {
      c.set(7, y, t.lit);
      c.set(8, y, t.shaded);
    }
    c.set(7, 1, t.light);
    c.set(8, 1, t.lit);
  },
  ink(c, cols) {
    for (let x = cols[0]; x <= cols[1]; x++) {
      if (x % 4 !== 3 || within(x, railing.centre)) continue;
      const snapped = c.get(x, RAIL_ROWS[0]) === OUTLINE;
      for (let y = snapped ? 8 : 2; y <= FOOT; y++) {
        if (y !== RAIL_ROWS[0] && y !== RAIL_ROWS[1]) c.set(x, y, OUTLINE);
      }
    }
  },
  wear(c, rng, t, cols) {
    const x = between(rng, Math.max(INNER[0], cols[0]), Math.min(INNER[1], cols[1]));
    if (!within(x, railing.centre)) c.set(x, pick(rng, RAIL_ROWS), t.light);
    c.set(7, between(rng, 3, 13), t.light);
    c.set(8, between(rng, 3, 13), t.dark);
  },
  damage(c, rng, t, cols) {
    if (rng() < 0.6) {
      c.set(7, 1, null);
      c.set(8, 1, null);
    }
    const gap = side(rng, cols, railing.centre);
    if (!gap) {
      c.set(8, between(rng, 5, 10), t.dark);
      return;
    }
    const x = between(rng, gap[0], gap[1] - 2);
    for (const dx of [0, 1, 2]) c.set(x + dx, RAIL_ROWS[0], null);
    c.set(x, RAIL_ROWS[1], t.dark);
  },
};

const drystone: Style = {
  centre: [3, 12],
  strip: [3, 12],
  band(c, x, t) {
    c.set(x, 5, x % 8 === 4 ? t.lit : t.light);
    c.set(x, 6, x % 8 === 4 ? t.shaded : t.lit);
    const courses = [
      [7, 9],
      [10, 12],
      [13, FOOT + 1],
    ] as const;
    courses.forEach(([top, joint], i) => {
      const seam = (x + i * 3) % 8 === 0;
      for (let y = top; y < joint; y++) {
        c.set(x, y, seam ? t.dark : y === top ? t.lit : t.shaded);
      }
      if (joint <= FOOT) c.set(x, joint, t.dark);
    });
  },
  along(c, y, t) {
    for (let x = drystone.strip[0]; x <= drystone.strip[1]; x++) {
      const seam = y % 8 === 7 || x === (Math.floor(y / 8) % 2 ? 9 : 6);
      c.set(x, y, seam ? t.shaded : x < 7 ? t.light : t.lit);
    }
  },
  wear(c, rng, t, cols) {
    for (let i = 0; i < 3; i++) {
      const x = between(rng, Math.max(INNER[0], cols[0]), Math.min(INNER[1], cols[1]));
      const y = between(rng, 5, 13);
      c.set(x, y, c.get(x, y) === t.shaded ? t.lit : t.shaded);
    }
  },
  damage(c, rng, t, cols) {
    const lo = Math.max(INNER[0], cols[0]);
    const hi = Math.min(INNER[1], cols[1]);
    const width = between(rng, 3, Math.min(6, hi - lo + 1));
    const x0 = between(rng, lo, hi - width + 1);
    for (let x = x0; x < x0 + width; x++) {
      const inner = x > x0 && x < x0 + width - 1;
      const depth = 7 + (inner ? between(rng, 1, 3) : between(rng, 0, 1));
      for (let y = 5; y < depth; y++) c.set(x, y, null);
      c.set(x, depth, t.lit);
    }
  },
};

const STYLES: Readonly<Record<Fence, Style>> = { picket, splitrail, railing, drystone };

/**
 * A fence piece. Its joined sides run to the tile edge and its other sides close with an
 * outline, so a run of pieces reads as one fence and passes the style lint as a whole.
 */
export function fence(p: FenceParams, rng: Rng): Sprite {
  const c = new Canvas(TILE, TILE);
  const s = STYLES[p.style];
  const t = tones(p.material);
  const has = (d: Dir) => (p.links & LINK[d]) !== 0;
  const cols: Span = [has('w') ? 0 : s.centre[0], has('e') ? TILE - 1 : s.centre[1]];
  if (has('n')) for (let y = 0; y <= MEET; y++) s.along(c, y, t);
  for (let x = cols[0]; x <= cols[1]; x++) s.band(c, x, t);
  if (has('s')) for (let y = MEET; y < TILE; y++) s.along(c, y, t);
  s.post?.(c, t);
  s.wear(c, rng, t, cols);
  if (p.broken) s.damage(c, rng, t, cols, p.links);
  c.outline();
  s.ink?.(c, cols);
  return c.toSprite();
}
