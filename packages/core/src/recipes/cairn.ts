import type { Hex, RampName } from '../palette.ts';
import { createRng, type Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { TILE } from '../world.ts';
import { Canvas, ramp } from './draw.ts';
import { rockBody } from './rock.ts';

export type CairnParams = {
  /** Bottom stone first, in the order they were added. */
  readonly stones: readonly RampName[];
};

/** One row of a cairn: the rock size of its stones and their centres from the cairn's centre. */
type Row = readonly [size: number, xs: readonly number[]];

/**
 * One fixed layout per count, bottom row first. Each stone drops onto the rows below it, so a
 * layout sets only rows and columns; a stone keeps its shape when a larger count re-seats it.
 */
const LAYOUTS: readonly (readonly Row[])[] = [
  [[1, [0]]],
  [
    [1, [-1]],
    [0.2, [2]],
  ],
  [
    [0.5, [-4, 4]],
    [0.35, [0]],
  ],
  [
    [0.35, [-7, 0, 7]],
    [0.3, [0]],
  ],
  [
    [0.35, [-7, 0, 7]],
    [0.2, [-4, 4]],
  ],
  [
    [0.4, [-7, 0, 7]],
    [0.2, [-4, 4]],
    [0.1, [0]],
  ],
  [
    [0.3, [-9, -3, 3, 9]],
    [0.25, [-4, 4]],
    [0.1, [0]],
  ],
  [
    [0.3, [-9, -3, 3, 9]],
    [0.25, [-6, 0, 6]],
    [0.25, [0]],
  ],
  [
    [0.3, [-9, -3, 3, 9]],
    [0.25, [-6, 0, 6]],
    [0.1, [0]],
    [0, [0]],
  ],
  [
    [0.3, [-9, -3, 3, 9]],
    [0.25, [-6, 0, 6]],
    [0.1, [-3, 3]],
    [0, [0]],
  ],
  [
    [0.3, [-9, -3, 3, 9]],
    [0.25, [-6, 0, 6]],
    [0.1, [-3, 3]],
    [0, [0]],
    [0, [0]],
  ],
  [
    [0.3, [-9, -3, 3, 9]],
    [0.25, [-6, 0, 6]],
    [0.1, [-3, 3]],
    [0, [-2, 2]],
    [0, [0]],
  ],
];

type Seat = readonly [row: number, x: number, size: number];

const SEATS: readonly (readonly Seat[])[] = LAYOUTS.map((rows) =>
  rows.flatMap(([size, xs], row) => xs.map((x): Seat => [row, x, size])),
);

export const CAIRN_MAX = SEATS.length;

const W = 2 * TILE;
const H = 2 * TILE;
/** The ground row; the row below it is for the outline. */
const FLOOR = H - 2;
/** Seven stone shades and the outline. */
const SHADES = 7;

type Pixel = { readonly x: number; readonly y: number; readonly hex: Hex };

function stonePixels(stone: RampName, size: number, seed: number): Pixel[] {
  const { canvas } = rockBody({ stone, size }, createRng(seed));
  const out: Pixel[] = [];
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const hex = canvas.get(x, y);
      if (hex) out.push({ x, y, hex });
    }
  }
  return out;
}

export function cairn(p: CairnParams, rng: Rng): Sprite {
  const stones = p.stones.slice(0, CAIRN_MAX);
  const seats = SEATS[Math.max(1, stones.length) - 1]!;
  const seeds = stones.map(() => Math.floor(rng() * 2 ** 31));
  const owner = new Int16Array(W * H).fill(-1);
  const colour: (Hex | null)[] = Array<Hex | null>(W * H).fill(null);
  const rowOf = (i: number) => seats[i]![0];

  stones.forEach((stone, i) => {
    const [row, sx, size] = seats[i]!;
    const pixels = stonePixels(stone, size, seeds[i]!);
    const left = Math.min(...pixels.map((q) => q.x));
    const right = Math.max(...pixels.map((q) => q.x));
    const top = Math.min(...pixels.map((q) => q.y));
    const bottom = Math.max(...pixels.map((q) => q.y));
    const dx = Math.round(W / 2 + sx - (left + right + 1) / 2);
    const blocked = (dy: number) =>
      pixels.some(({ x, y }) => {
        const o = owner[(y + dy) * W + x + dx]!;
        return o !== -1 && rowOf(o) < row;
      });
    let dy = -top;
    while (bottom + dy < FLOOR && !blocked(dy + 1)) dy++;
    // Sunk a pixel, a stone's dark underside becomes the seam with the stone below.
    if (row > 0) dy++;
    for (const { x, y, hex } of pixels) {
      const at = (y + dy) * W + x + dx;
      owner[at] = i;
      colour[at] = hex;
    }
  });

  /** The rock's crack and lip shade. */
  const darkest = stones.map((stone) => ramp(stone)[ramp(stone).length - 4]!);
  fillHoles(owner, colour, darkest);
  const seams: number[] = [];
  for (let at = 0; at < W * H; at++) {
    const i = owner[at]!;
    if (i === -1) continue;
    if (neighboursOf(at).some((n) => owner[n]! > i && rowOf(owner[n]!) === rowOf(i)))
      seams.push(at);
  }
  for (const at of seams) colour[at] = darkest[owner[at]!]!;

  const merged = mergeShades(colour, owner, stones, darkest);
  const c = new Canvas(W, H);
  let minX = W;
  let maxX = -1;
  for (let at = 0; at < W * H; at++) {
    const hex = colour[at];
    if (!hex) continue;
    c.set(at % W, Math.floor(at / W), merged.get(hex) ?? hex);
    minX = Math.min(minX, at % W);
    maxX = Math.max(maxX, at % W);
  }
  c.outline();
  c.shadow((minX + maxX + 1) / 2, H - 0.8, (maxX - minX + 1) / 2 + 1, 1.2);
  return c.toSprite();
}

const neighboursOf = (at: number) => {
  const x = at % W;
  return [at - W, at + W, x > 0 ? at - 1 : -1, x < W - 1 ? at + 1 : -1].filter(
    (n) => n >= 0 && n < W * H,
  );
};

/** Gaps the stones close off would outline as black holes; they take the shade of a stone beside them. */
function fillHoles(owner: Int16Array, colour: (Hex | null)[], darkest: readonly Hex[]): void {
  const outside = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let at = 0; at < W * H; at++) {
    const x = at % W;
    const border = x === 0 || x === W - 1 || at < W || at >= W * (H - 1);
    if (border && owner[at] === -1) {
      outside[at] = 1;
      stack.push(at);
    }
  }
  while (stack.length > 0) {
    for (const n of neighboursOf(stack.pop()!)) {
      if (owner[n] !== -1 || outside[n]) continue;
      outside[n] = 1;
      stack.push(n);
    }
  }
  let open = true;
  while (open) {
    open = false;
    for (let at = 0; at < W * H; at++) {
      if (owner[at] !== -1 || outside[at]) continue;
      const beside = neighboursOf(at).find((n) => owner[n] !== -1);
      if (beside === undefined) {
        open = true;
        continue;
      }
      owner[at] = owner[beside]!;
      colour[at] = darkest[owner[beside]!]!;
    }
  }
}

const rgb = (hex: Hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};
const distance = (a: Hex, b: Hex) => {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return Math.hypot(ar - br, ag - bg, ab - bb);
};

/**
 * Stones of several materials can need more colours than a sprite may use. Merge the closest
 * two shades of one material, never its seam shade while another pair remains, until they fit;
 * each stone keeps its own material's colours.
 */
function mergeShades(
  colour: readonly (Hex | null)[],
  owner: Int16Array,
  stones: readonly RampName[],
  darkest: readonly Hex[],
): Map<Hex, Hex> {
  const uses = new Map<RampName, Map<Hex, number>>();
  const seam = new Set(darkest);
  colour.forEach((hex, at) => {
    if (!hex) return;
    const material = stones[owner[at]!]!;
    const counts = uses.get(material) ?? new Map<Hex, number>();
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
    uses.set(material, counts);
  });
  const merged = new Map<Hex, Hex>();
  const total = () => [...uses.values()].reduce((n, m) => n + m.size, 0);
  while (total() > SHADES) {
    let best: { counts: Map<Hex, number>; a: Hex; b: Hex; cost: number } | undefined;
    for (const counts of uses.values()) {
      const hexes = [...counts.keys()];
      for (const a of hexes) {
        for (const b of hexes) {
          if (a >= b) continue;
          const cost = distance(a, b) + (seam.has(a) || seam.has(b) ? 1e6 : 0);
          if (!best || cost < best.cost) best = { counts, a, b, cost };
        }
      }
    }
    if (!best) break;
    const { counts, a, b } = best;
    const [keep, drop] = counts.get(a)! >= counts.get(b)! ? [a, b] : [b, a];
    counts.set(keep, counts.get(keep)! + counts.get(drop)!);
    counts.delete(drop);
    for (const [from, to] of merged) if (to === drop) merged.set(from, keep);
    merged.set(drop, keep);
  }
  return merged;
}
