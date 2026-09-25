import { cellMemo, type BiomeField } from './biome.ts';
import { hash4, unit } from './noise.ts';
import type { Box, Point } from './roads.ts';

/** At most one river to a cell of this grid, about nine screens square. */
export const RIVER_CELL_W = 180;
export const RIVER_CELL_H = 144;
/**
 * A river's water, pond and widest bank included, stays this far inside its cell, so rivers in
 * neighbouring cells never meet.
 */
const RIVER_MARGIN = 3;
const SPRING_WIDTH = 0.8;
const MOUTH_WIDTH = 2.1;
const POND_RADIUS = [2.5, 4] as const;
const POINTS = 64;
const BENDS = 7;
/** Water depth below -FAR is only an upper bound, which no caller looks beyond. */
export const FAR = 24;

/**
 * An open curve of water from a spring to a pond, its half-width growing downstream. Rivers never
 * meet each other or a lake, and an open curve encloses nothing, so land stays connected.
 */
export type River = {
  /** The centre line, spring first. */
  readonly path: readonly Point[];
  readonly pond: {
    readonly x: number;
    readonly y: number;
    readonly r: number;
    readonly phase: number;
  };
  /** Every water point lies inside. */
  readonly box: Box;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** The layer's rivers, each a pure function of its cell. */
export function riverField(
  seed: number,
  biome: BiomeField,
  clear: (box: Box) => boolean,
): (cellX: number, cellY: number) => readonly River[] {
  return cellMemo((cellX, cellY) => {
    const river = makeRiver(seed, biome, cellX, cellY);
    return river && clear(river.box) ? [river] : [];
  });
}

/**
 * A chord across the cell bent by a few sine modes that vanish at both ends, so the centre line
 * is a function of the chord and never loops back on itself.
 */
function makeRiver(
  seed: number,
  biome: BiomeField,
  cellX: number,
  cellY: number,
): River | undefined {
  const cell = hash4(seed, cellX, cellY, 0);
  const roll = (k: number) => unit(hash4(cell, k, 0, 0));
  const x0 = cellX * RIVER_CELL_W;
  const y0 = cellY * RIVER_CELL_H;
  if (roll(0) >= biome(x0 + RIVER_CELL_W / 2, y0 + RIVER_CELL_H / 2).params.riverChance) {
    return undefined;
  }
  const angle = roll(1) * 2 * Math.PI;
  const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
  const half = lerp(45, 85, roll(2));
  const bend = lerp(0.12, 0.25, roll(3)) * half;
  const modes = Array.from({ length: BENDS }, (_, k) => (2 * roll(4 + k) - 1) / Math.sqrt(k + 1));
  const offsets = Array.from({ length: POINTS }, (_, i) =>
    modes.reduce((sum, m, k) => sum + m * Math.sin((k + 1) * Math.PI * (i / (POINTS - 1))), 0),
  );
  const peak = Math.max(...offsets.map(Math.abs)) || 1;
  const local = offsets.map((o, i) => {
    const along = lerp(-half, half, i / (POINTS - 1));
    const across = (o / peak) * bend;
    return { x: along * ux - across * uy, y: along * uy + across * ux };
  });

  const r = lerp(POND_RADIUS[0], POND_RADIUS[1], roll(10));
  const pad = r * 1.2 + RIVER_MARGIN;
  const xs = local.map((p) => p.x);
  const ys = local.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const fit = Math.min(
    1,
    (RIVER_CELL_W - 2 * pad) / (maxX - minX),
    (RIVER_CELL_H - 2 * pad) / (maxY - minY),
  );
  const cx = x0 + lerp(pad - fit * minX, RIVER_CELL_W - pad - fit * maxX, roll(11));
  const cy = y0 + lerp(pad - fit * minY, RIVER_CELL_H - pad - fit * maxY, roll(12));
  const path = local.map((p) => ({ x: cx + p.x * fit, y: cy + p.y * fit }));
  const mouth = path[path.length - 1]!;
  const reach = pad - RIVER_MARGIN;
  return {
    path,
    pond: { x: mouth.x, y: mouth.y, r, phase: roll(13) * 2 * Math.PI },
    box: {
      x0: cx + fit * minX - reach,
      y0: cy + fit * minY - reach,
      x1: cx + fit * maxX + reach,
      y1: cy + fit * maxY + reach,
    },
  };
}

/** How far inside the river's water a point is, in lattice units; negative outside. */
export function riverDepth({ path, pond, box }: River, x: number, y: number): number {
  const out = Math.hypot(Math.max(box.x0 - x, 0, x - box.x1), Math.max(box.y0 - y, 0, y - box.y1));
  if (out > FAR) return -out;
  let depth = pond.r * (1 + 0.2 * Math.sin(3 * Math.atan2(y - pond.y, x - pond.x) + pond.phase));
  depth -= Math.hypot(x - pond.x, y - pond.y);
  // Width varies by less than MOUTH_WIDTH - SPRING_WIDTH, so a segment farther than that beyond
  // the nearest one so far cannot be the deepest.
  let closest = Infinity;
  let within = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const { d2, s } = distanceSq(path[i]!, path[i + 1]!, x, y);
    if (d2 > within) continue;
    const d = Math.sqrt(d2);
    if (d < closest) [closest, within] = [d, (d + MOUTH_WIDTH - SPRING_WIDTH) ** 2];
    depth = Math.max(depth, lerp(SPRING_WIDTH, MOUTH_WIDTH, (i + s) / (path.length - 1)) - d);
  }
  return depth;
}

/** Squared distance from (x, y) to segment ab, and how far along ab its nearest point is. */
function distanceSq(a: Point, b: Point, x: number, y: number): { d2: number; s: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const s = Math.min(1, Math.max(0, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
  const ox = a.x + s * dx - x;
  const oy = a.y + s * dy - y;
  return { d2: ox * ox + oy * oy, s };
}
