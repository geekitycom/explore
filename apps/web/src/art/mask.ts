import { TILE } from '@explore/core';

/**
 * Terrain edges for layered terrain, drawn the way marching squares draws a contour. For each
 * layer every lattice corner gets a value, positive when its terrain is at or above the layer
 * and negative below, firmer the more its neighbours agree. Inside a tile the field is the
 * bilinear blend of its four corner values plus a small fringe, and the layer covers the pixels
 * where the field is positive. A corner whose neighbours mostly disagree gives way, so an edge
 * follows the trend of the terrain around it instead of squaring off at every tile side.
 *
 * Seams: a corner on the screen border weighs only its neighbours along that border, which
 * both screens share, and a screen corner weighs only itself. The pixels on the screen's outer
 * edge take the field on the border line itself, so neighbouring screens draw them the same.
 */
export function cornerMask(
  layers: readonly [number, number, number, number],
  layer: number,
): number {
  let mask = 0;
  for (let i = 0; i < 4; i++) if (layers[i]! >= layer) mask |= 1 << i;
  return mask;
}

/** How firmly a corner holds its terrain when its neighbours outvote it. */
const FLOOR = 0.4;

/** Tips a two-corner diagonal saddle toward joining the higher terrain. */
const BIAS = 0.03;

const NEIGHBOURS = [-1, 0, 1].flatMap((dy) =>
  [-1, 0, 1].map((dx) => [dx, dy, dx !== 0 && dy !== 0 ? 0.5 : 1] as const),
);

/**
 * How far an edge wobbles out (+) or in (-), in pixels, at each pixel along a tile side. It
 * moves the edge along the field's slope, so it fades where the slope does, at a saddle. The
 * two ends match so neighbouring tiles meet, and values within 4 keep a tile whose corners are
 * all outside the layer empty.
 */
export type Fringe = readonly number[];

const mirrored = (half: readonly number[]): Fringe => [...half, ...half.toReversed()];

/** A gentle ruffle, as on the pack's sand and dirt edges. */
export const WAVES = mirrored([0, 0.4, 0.7, 0.9, 0.7, 0.2, -0.4, -0.7]);

/** Short blades poking over the terrain below, as on the pack's grass edges. */
export const TUFTS = [-1, 0.5, 2, 3.5, 2, 0.5, -1.2, -1.2, 0, 1.6, 3, 1.6, 0, -1, -1.4, -1];

/** Each corner's value for `layer` on a whole screen's lattice (latticeW x latticeH). */
function cornerValues(
  lattice: ArrayLike<number>,
  latticeW: number,
  latticeH: number,
  layer: number,
): Float32Array {
  const sign = (cx: number, cy: number) => (lattice[cy * latticeW + cx]! >= layer ? 1 : -1);
  const out = new Float32Array(latticeW * latticeH);
  for (let cy = 0; cy < latticeH; cy++) {
    const onRow = cy === 0 || cy === latticeH - 1;
    for (let cx = 0; cx < latticeW; cx++) {
      const onColumn = cx === 0 || cx === latticeW - 1;
      let sum = 0;
      let total = 0;
      for (const [dx, dy, w] of NEIGHBOURS) {
        if ((onColumn && dx !== 0) || (onRow && dy !== 0)) continue;
        sum += w * sign(cx + dx, cy + dy);
        total += w;
      }
      const own = sign(cx, cy);
      out[cy * latticeW + cx] = own * Math.max(FLOOR, (own * sum) / total);
    }
  }
  return out;
}

/**
 * The pixels of a whole screen's lattice (latticeW x latticeH, row-major terrain layer
 * indexes) that `layer` covers, 1 where covered. A tile takes the fringe (by terrain layer
 * index) of the lowest of its terrains at or above the layer: that terrain's edge is the one
 * that shows, so the layers beneath it share its outline.
 */
export function layerRegion(
  lattice: ArrayLike<number>,
  latticeW: number,
  latticeH: number,
  layer: number,
  fringes: readonly Fringe[],
): Uint8Array {
  const values = cornerValues(lattice, latticeW, latticeH, layer);
  const w = (latticeW - 1) * TILE;
  const region = new Uint8Array(w * (latticeH - 1) * TILE);
  for (let ty = 0; ty < latticeH - 1; ty++) {
    for (let tx = 0; tx < latticeW - 1; tx++) {
      const index = [
        ty * latticeW + tx,
        ty * latticeW + tx + 1,
        (ty + 1) * latticeW + tx,
        (ty + 1) * latticeW + tx + 1,
      ] as const;
      const corners = index.map((i) => lattice[i]!);
      const inside = corners.filter((c) => c >= layer);
      if (inside.length === 0) continue;
      const fringe = fringes[Math.min(...inside)]!;
      const [nw, ne, sw, se] = index.map((i) => values[i]!) as [number, number, number, number];
      for (let y = 0; y < TILE; y++) {
        const v = (y + 0.5) / TILE;
        const west = nw + (sw - nw) * v;
        const east = ne + (se - ne) * v;
        for (let x = 0; x < TILE; x++) {
          const u = (x + 0.5) / TILE;
          const across = east - west;
          const down = sw - nw + (se - ne - sw + nw) * u;
          const slope = Math.hypot(across, down) || 1;
          const shift = (down * down * fringe[x]! + across * across * fringe[y]!) / slope;
          const field = west + across * u + BIAS + shift / TILE;
          if (field > 0) region[(ty * TILE + y) * w + tx * TILE + x] = 1;
        }
      }
    }
  }

  const h = (latticeH - 1) * TILE;
  const onBorder = (a: number, b: number, along: number) => {
    const inside = [lattice[a]!, lattice[b]!].filter((c) => c >= layer);
    if (inside.length === 0) return 0;
    const t = ((along % TILE) + 0.5) / TILE;
    const slope = values[b]! - values[a]!;
    const shift = (fringes[Math.min(...inside)]![0]! * Math.abs(slope)) / TILE;
    return values[a]! + slope * t + BIAS + shift > 0 ? 1 : 0;
  };
  const bottom = (latticeH - 1) * latticeW;
  for (let y = 0; y < h; y++) {
    const row = Math.floor(y / TILE) * latticeW;
    region[y * w] = onBorder(row, row + latticeW, y);
    region[y * w + w - 1] = onBorder(row + latticeW - 1, row + 2 * latticeW - 1, y);
  }
  for (let x = 0; x < w; x++) {
    const column = Math.floor(x / TILE);
    region[x] = onBorder(column, column + 1, x);
    region[(h - 1) * w + x] = onBorder(bottom + column, bottom + column + 1, x);
  }

  // Tiles weigh their fringes a little differently along a shared side, which can strand a
  // lone pixel there.
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = region[i];
      if (region[i - 1] !== v && region[i + 1] !== v && region[i - w] !== v && region[i + w] !== v)
        region[i] = 1 - v!;
    }
  return region;
}

const offsetsWithin = (reach: number) => {
  const offsets: [number, number, number][] = [];
  const r = Math.ceil(reach);
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > 0 && d <= reach) offsets.push([dx, dy, d]);
    }
  return offsets.sort((a, b) => a[2] - b[2]);
};

/**
 * Distance from each pixel to the nearest pixel on the other side of the region's edge:
 * negative inside, positive outside, Infinity beyond `reach`. Pixels past the image border
 * repeat the border pixel. A pixel on the border looks only along the border, which the
 * neighbouring screen draws the same, so both screens band their shared edge alike; a pixel
 * in an image corner, shared by four screens, gets no band.
 */
export function edgeDistance(
  region: Uint8Array,
  w: number,
  h: number,
  reach: number,
): Float32Array {
  const offsets = offsetsWithin(reach);
  const r = Math.ceil(reach);
  const shifts = Int32Array.from(offsets, ([dx, dy]) => dy * w + dx);
  const dists = Float64Array.from(offsets, ([, , d]) => d);
  const out = new Float32Array(w * h).fill(Infinity);
  const edgePixel = (i: number, x: number, y: number) =>
    (x > 0 && region[i - 1] !== region[i]) ||
    (x < w - 1 && region[i + 1] !== region[i]) ||
    (y > 0 && region[i - w] !== region[i]) ||
    (y < h - 1 && region[i + w] !== region[i]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!edgePixel(i, x, y)) continue;
      const v = region[i];
      if (x > r && y > r && x < w - 1 - r && y < h - 1 - r) {
        for (let k = 0; k < shifts.length; k++) {
          const j = i + shifts[k]!;
          if (region[j] !== v && dists[k]! < out[j]!) out[j] = dists[k]!;
        }
        continue;
      }
      for (const [dx, dy, dist] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
        const j = ny * w + nx;
        if (region[j] !== v && dist < out[j]!) out[j] = dist;
      }
    }

  const steps = Math.floor(reach);
  const alongBorder = (i: number, at: number, length: number, stride: number) => {
    const v = region[i];
    for (let k = 1; k <= steps; k++) {
      const back = Math.max(0, at - k) - at;
      const ahead = Math.min(length - 1, at + k) - at;
      if (region[i + back * stride] !== v || region[i + ahead * stride] !== v) return k;
    }
    return Infinity;
  };
  for (let y = 1; y < h - 1; y++) {
    out[y * w] = alongBorder(y * w, y, h, w);
    out[y * w + w - 1] = alongBorder(y * w + w - 1, y, h, w);
  }
  for (let x = 1; x < w - 1; x++) {
    out[x] = alongBorder(x, x, w, 1);
    out[(h - 1) * w + x] = alongBorder((h - 1) * w + x, x, w, 1);
  }

  for (let i = 0; i < out.length; i++) if (region[i]) out[i] = -out[i]!;
  return out;
}
