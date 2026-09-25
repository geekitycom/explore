import { OUTLINE, type RampName } from '../palette.ts';
import type { Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { TILE } from '../world.ts';
import { Canvas, ramp } from './draw.ts';

export type BonesParams = {
  readonly form: 'cattle' | 'ram' | 'scatter' | 'ribs';
  /** Bleached bone, drawn from the pale end of the ramp. */
  readonly bone: RampName;
};

/** Rows of a drawing: `#` bone, `o` a socket or crack, anything else empty. */
type Grid = string[][];

const grid = (rows: readonly string[]): Grid => rows.map((row) => [...row]);

const CATTLE = [
  '##.........##',
  '.##.......##.',
  '..#########..',
  '...#######...',
  '...#o###o#...',
  '....#####....',
  '....#####....',
  '.....###.....',
  '.....o#o.....',
  '.....###.....',
];

const RAM = [
  '.##.......##.',
  '#..#.....#..#',
  '#..#######..#',
  '.#.#o###o#.#.',
  '...#######...',
  '....#####....',
  '.....###.....',
  '.....o#o.....',
  '.....###.....',
];

const CRACKS: readonly (readonly [number, number])[] = [
  [5, 2],
  [6, 3],
  [7, 2],
  [5, 3],
  [7, 5],
];

function skull(rows: readonly string[], rng: Rng, horns: number): Grid {
  const g = grid(rows);
  const w = g[0]!.length;
  // Each horn stays whole, loses its tip, or snaps off near the skull.
  for (const side of [0, 1]) {
    const roll = rng();
    const lost = roll < 0.55 ? 0 : roll < 0.85 ? 1 : horns;
    for (let y = 0; y < lost; y++) {
      for (let x = 0; x < 3; x++) g[y]![side ? w - 1 - x : x] = '.';
    }
  }
  if (rng() < 0.6) {
    const [x, y] = CRACKS[Math.floor(rng() * CRACKS.length)]!;
    g[y]![x] = 'o';
  }
  return g;
}

function longBone(length: number): Grid {
  const inner = '.'.repeat(length - 4);
  return grid([`##${inner}##`, `.${'#'.repeat(length - 2)}.`, `##${inner}##`]);
}

const SHORT_BONES: readonly Grid[] = [
  grid(['##...', '###..', '.###.', '..###', '...##']),
  grid(['.###.', '#o#o#', '.###.']),
  grid(['##', '##']),
];

const mirror = (g: Grid): Grid => g.map((row) => [...row].reverse());

/** A long bone lying along the ground and one or two smaller pieces strewn behind it. */
function scatter(rng: Rng): Grid {
  const w = 14;
  const h = 11;
  const g: Grid = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  const fits = (piece: Grid, ox: number, oy: number) =>
    piece.every((row, y) =>
      row.every((c, x) => {
        if (c !== '#') return true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) if (g[oy + y + dy]?.[ox + x + dx] === '#') return false;
        }
        return oy + y < h && ox + x >= 0 && ox + x < w;
      }),
    );
  const put = (piece: Grid, ox: number, oy: number) =>
    piece.forEach((row, y) => row.forEach((c, x) => c === '#' && (g[oy + y]![ox + x] = c)));

  const length = 6 + Math.floor(rng() * 4);
  put(longBone(length), Math.floor((w - length) / 2 + (rng() - 0.5) * 2), h - 3);
  const pieces = 1 + Math.floor(rng() * 2);
  for (let placed = 0, tries = 0; placed < pieces && tries < 40; tries++) {
    let piece =
      rng() < 0.3
        ? longBone(4 + Math.floor(rng() * 2))
        : SHORT_BONES[Math.floor(rng() * SHORT_BONES.length)]!;
    if (rng() < 0.5) piece = mirror(piece);
    const ox = Math.floor(rng() * (w - piece[0]!.length + 1));
    const oy = Math.floor(rng() * (h - 3 - piece.length));
    if (!fits(piece, ox, oy)) continue;
    put(piece, ox, oy);
    placed++;
  }
  return g;
}

/** A spine lying sideways, short ribs arching behind it and long ones in front. */
function ribs(rng: Rng): Grid {
  const count = 4 + Math.floor(rng() * 2);
  const w = count * 2 + 3;
  const spine = 2;
  const g: Grid = Array.from({ length: spine + 6 }, () => Array<string>(w).fill('.'));
  for (let x = 0; x < w - Math.floor(rng() * 2); x++) g[spine]![x] = '#';
  for (let i = 0; i < count; i++) {
    const x = 2 + i * 2;
    const arch = Math.sin(((i + 0.5) / count) * Math.PI);
    const full = Math.round(2 + 2.6 * arch);
    const down = rng() < 0.2 ? 1 + Math.floor(rng() * (full - 1)) : full;
    for (let y = 1; y <= down; y++) g[spine + y]![x] = '#';
    const up = rng() < 0.2 ? 0 : Math.round(1 + arch);
    for (let y = 1; y <= up; y++) g[spine - y]![x] = '#';
  }
  return rng() < 0.5 ? mirror(g) : g;
}

function trimmed(g: Grid): Grid {
  const rows = g.filter((row) => row.includes('#'));
  const cols = rows[0]!.map((_, x) => rows.some((row) => row[x] !== '.'));
  const left = cols.indexOf(true);
  const right = cols.lastIndexOf(true);
  return rows.map((row) => row.slice(left, right + 1));
}

const FORMS: Record<BonesParams['form'], (rng: Rng) => Grid> = {
  cattle: (rng) => skull(CATTLE, rng, 2),
  ram: (rng) => skull(RAM, rng, 1),
  scatter,
  ribs,
};

export function bones(p: BonesParams, rng: Rng): Sprite {
  const g = trimmed(FORMS[p.form](rng));
  const w = g[0]!.length;
  const h = g.length;
  const shift = Math.floor(rng() * 3) - 1;
  const ox = Math.max(1, Math.min(TILE - 1 - w, Math.floor((TILE - w) / 2) + shift));
  const oy = TILE - 1 - h;
  const r = ramp(p.bone);
  const L = r.length - 1;
  const [under, side, body] = [r[L - 2]!, r[L - 1]!, r[L]!];
  const on = (x: number, y: number) => (g[y]?.[x] ?? '.') !== '.';

  const c = new Canvas(TILE, TILE);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = g[y]![x];
      if (cell === '.') continue;
      let colour = body;
      if (cell === 'o') colour = OUTLINE;
      else if (on(x, y - 1) && !on(x, y + 1)) colour = under;
      else if (on(x - 1, y) && !on(x + 1, y)) colour = side;
      c.set(ox + x, oy + y, colour);
    }
  }
  c.outline();
  c.shadow(ox + w / 2, TILE - 0.8, w / 2 + 1, 1.2);
  return c.toSprite();
}
