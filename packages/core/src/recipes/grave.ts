import { OUTLINE, type Hex, type RampName } from '../palette.ts';
import type { Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { TILE } from '../world.ts';
import { Canvas, Mask, ramp } from './draw.ts';

export type GraveParams = {
  readonly form: 'headstone' | 'cross' | 'cairn' | 'open';
  /** The marker: stone for a headstone or cairn, wood for a cross; an open grave has none. */
  readonly material: RampName;
  /** The ground heaped over the grave, or dug out of an open one. */
  readonly earth: RampName;
  /** Moss or lichen creeping over stone. */
  readonly moss?: RampName;
};

/** A ramp's top four colours, lightest first. */
function tones(name: RampName) {
  const r = ramp(name);
  const n = r.length;
  return { light: r[n - 1]!, lit: r[n - 2]!, shaded: r[n - 3]!, dark: r[n - 4]! };
}

type Tones = ReturnType<typeof tones>;

const pick = <T>(rng: Rng, options: readonly T[]): T =>
  options[Math.floor(rng() * options.length)]!;

/** The row a marker's foot stands on, just behind the mound. */
const FOOT = 11;

/** The low mound over a grave, drawn in front of its marker. */
function mound(c: Canvas, earth: Tones, rng: Rng, cx: number) {
  const m = new Mask(TILE, TILE);
  m.ellipse(cx, 13.6, 4.4 + rng() * 1.2, 2.8);
  for (let y = FOOT; y < TILE - 1; y++) {
    for (let x = 1; x < TILE - 1; x++) {
      if (m.has(x, y)) c.set(x, y, m.has(x, y - 1) ? earth.shaded : earth.lit);
    }
  }
}

/** Upper rows of a leaning marker shift one pixel sideways. */
function leanOf(rng: Rng, chance: number): number {
  return rng() < chance ? pick(rng, [-1, 1]) : 0;
}

function headstone(c: Canvas, p: GraveParams, rng: Rng): number {
  const s = tones(p.material);
  const w = 5 + Math.floor(rng() * 3);
  const h = 7 + Math.floor(rng() * 3);
  const top = FOOT + 1 - h;
  const x0 = 8 - Math.floor(w / 2) + pick(rng, [-1, 0, 0, 1]);
  const lean = leanOf(rng, 0.3);
  const shape = pick(rng, ['round', 'round', 'flat', 'peak'] as const);
  const inset = (row: number) => {
    if (shape === 'round') return row === 0 ? 1 : 0;
    if (shape === 'peak') return Math.max(0, Math.ceil(w / 2) - 1 - row);
    return 0;
  };
  const span = (y: number) => {
    const shift = y < top + h / 2 ? lean : 0;
    const i = inset(y - top);
    return [x0 + i + shift, x0 + w - 1 - i + shift] as const;
  };
  for (let y = top; y <= FOOT; y++) {
    const [left, right] = span(y);
    for (let x = left; x <= right; x++) {
      const above = y > top && x >= span(y - 1)[0] && x <= span(y - 1)[1];
      c.set(x, y, x === right ? s.shaded : !above || x === left ? s.light : s.lit);
    }
  }
  if (rng() < 0.7) {
    for (const [row, trim] of [
      [2, 2],
      [4, 3],
    ] as const) {
      const [left, right] = span(top + row);
      for (let x = left + trim; x <= right - trim; x++) c.set(x, top + row, s.shaded);
    }
  }
  if (rng() < 0.45) {
    const [left, right] = span(top + 3);
    let x = left + 1 + Math.floor(rng() * Math.max(1, right - left - 1));
    const bend = pick(rng, [-1, 1]);
    for (let y = top + 3; y < top + 6; y++, x += bend) {
      if (x > left && x < right) c.set(x, y, s.dark);
    }
  }
  if (rng() < 0.35) {
    const [, right] = span(top);
    c.set(right, top, null);
  }
  if (p.moss && rng() < 0.75) {
    const moss = tones(p.moss).lit;
    const side = rng() < 0.5;
    for (let k = 0, n = 2 + Math.floor(rng() * 3); k < n; k++) {
      const y = FOOT - Math.floor(rng() * 3);
      const [left, right] = span(y);
      c.set(side ? left + Math.floor(rng() * 2) : right - Math.floor(rng() * 2), y, moss);
    }
  }
  return x0 + w / 2;
}

function cross(c: Canvas, p: GraveParams, rng: Rng): number {
  const wood = tones(p.material);
  const h = 8 + Math.floor(rng() * 3);
  const top = FOOT + 1 - h;
  const post = 7 + Math.floor(rng() * 2);
  const lean = leanOf(rng, 0.35);
  const shift = (y: number) => (y < top + h / 2 ? lean : 0);
  for (let y = top; y <= FOOT; y++) {
    c.set(post + shift(y), y, y === top ? wood.light : wood.lit);
    c.set(post + 1 + shift(y), y, wood.shaded);
  }
  const reach = 2 + Math.floor(rng() * 2);
  const lost = rng() < 0.2 ? pick(rng, [-1, 1]) : 0;
  const bar = top + 2;
  for (let x = post - reach; x <= post + 1 + reach; x++) {
    if ((lost < 0 && x < post) || (lost > 0 && x > post + 1)) continue;
    c.set(x + shift(bar), bar, wood.light);
    c.set(x + shift(bar), bar + 1, wood.shaded);
  }
  if (rng() < 0.4) {
    const y = FOOT - 2 - Math.floor(rng() * 3);
    c.set(post + shift(y), y, wood.dark);
  }
  return post + 1;
}

/** Stones heaped over a grave, the front ones overlapping those behind. */
function cairn(c: Canvas, p: GraveParams, rng: Rng): number {
  const s = tones(p.material);
  const jitter = () => (rng() - 0.5) * 1.2;
  const stones: [number, number][] = [
    ...(rng() < 0.75 ? [[8 + jitter(), 6.6] as [number, number]] : []),
    [6.5 + jitter(), 9.4],
    [9.5 + jitter(), 9.4],
    [5 + jitter(), 12.4],
    [8 + jitter(), 12.6],
    [11 + jitter(), 12.4],
  ];
  const moss = p.moss && rng() < 0.6 ? tones(p.moss).lit : undefined;
  for (const [cx, cy] of stones) {
    const m = new Mask(TILE, TILE);
    m.ellipse(cx, cy, 2.1 + rng() * 0.5, 1.7 + rng() * 0.3);
    for (let y = 0; y < TILE - 1; y++) {
      for (let x = 1; x < TILE - 1; x++) {
        if (!m.has(x, y)) continue;
        const edge = !m.has(x - 1, y) || !m.has(x + 1, y) || !m.has(x, y - 1);
        let colour: Hex = !m.has(x, y - 1) ? s.light : !m.has(x, y + 1) ? s.shaded : s.lit;
        if (edge && c.get(x, y)) colour = OUTLINE;
        else if (moss && !m.has(x, y - 1) && rng() < 0.3) colour = moss;
        c.set(x, y, colour);
      }
    }
  }
  return 8;
}

/** A dark pit with its lip showing all round and the dug earth heaped to one side. */
function open(c: Canvas, p: GraveParams, rng: Rng): number {
  const earth = tones(p.earth);
  const hole = ramp(p.earth)[0]!;
  const side = pick(rng, [-1, 1]);
  const w = 7 + Math.floor(rng() * 2);
  const x0 = 8 - Math.floor(w / 2) - side;
  const x1 = x0 + w - 1;
  const top = 7 + Math.floor(rng() * 2);
  for (let y = top; y < TILE - 1; y++) {
    for (let x = x0; x <= x1; x++) {
      const lip = y === top || y === TILE - 2 || x === x0 || x === x1;
      c.set(x, y, y === top ? earth.light : lip ? earth.lit : y === TILE - 3 ? earth.dark : hole);
    }
  }
  const heap = new Mask(TILE, TILE);
  heap.ellipse(side < 0 ? x0 - 1 : x1 + 2, 11, 3 + rng() * 0.8, 3.6 + rng() * 0.6);
  for (let y = 0; y < TILE - 1; y++) {
    for (let x = 1; x < TILE - 1; x++) {
      if (!heap.has(x, y)) continue;
      const colour = !heap.has(x, y - 1)
        ? earth.light
        : !heap.has(x, y + 1)
          ? earth.shaded
          : earth.lit;
      c.set(x, y, colour === earth.lit && rng() < 0.12 ? earth.shaded : colour);
    }
  }
  return 8;
}

const FORMS: Record<GraveParams['form'], (c: Canvas, p: GraveParams, rng: Rng) => number> = {
  headstone,
  cross,
  cairn,
  open,
};

export function grave(p: GraveParams, rng: Rng): Sprite {
  const c = new Canvas(TILE, TILE);
  const cx = FORMS[p.form](c, p, rng);
  if (p.form === 'headstone' || p.form === 'cross') mound(c, tones(p.earth), rng, cx);
  c.outline();
  c.shadow(8, TILE - 0.8, 6, 1.2);
  return c.toSprite();
}
