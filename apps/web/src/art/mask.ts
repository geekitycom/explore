import { TILE } from '@explore/core';

/**
 * Corner-mask geometry for layered terrain. A tile's mask for a layer has one bit per corner
 * whose terrain is at or above that layer: NW=1, NE=2, SW=4, SE=8.
 *
 * Each mask's shape is the positive part of a field summed over the tile's four corners: +w(d)
 * for a corner inside the layer, -w(d) for one outside, where w falls to zero at REACH. A pixel
 * never sees corners of another tile, so the field is continuous across tile borders and every
 * edge crosses a tile side at its midpoint. The falloff turns single corners into rounded blobs
 * and three-corner masks into rounded inner corners.
 */
export const CORNER_BITS = { nw: 1, ne: 2, sw: 4, se: 8 } as const;

const CORNERS = [
  [0, 0],
  [TILE, 0],
  [0, TILE],
  [TILE, TILE],
] as const;

/** Half a pixel short of a tile, so the edge column only sees the two corners on its side. */
const REACH = TILE - 0.5;

/** Tips a two-corner diagonal saddle toward joining the higher terrain. */
const BIAS = 0.03;

/**
 * A hand-tuned wobble along each axis, mirrored so a tile's first and last columns see the same
 * value and neighbours stay continuous. It turns straight edges into the pack's ruffled ones.
 */
const RUFFLE_HALF = [0, 0.03, 0.07, 0.09, 0.07, 0.02, -0.04, -0.07];
const RUFFLE = [...RUFFLE_HALF, ...RUFFLE_HALF.toReversed()];

export function cornerMask(
  layers: readonly [number, number, number, number],
  layer: number,
): number {
  let mask = 0;
  for (let i = 0; i < 4; i++) if (layers[i]! >= layer) mask |= 1 << i;
  return mask;
}

function falloff(d: number): number {
  const t = 1 - (d / REACH) ** 2;
  return t > 0 ? t * t : 0;
}

function covers(mask: number, x: number, y: number): boolean {
  const px = x + 0.5;
  const py = y + 0.5;
  let f = BIAS + RUFFLE[x]! + RUFFLE[y]!;
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = CORNERS[i]!;
    f += (mask & (1 << i) ? 1 : -1) * falloff(Math.hypot(px - cx, py - cy));
  }
  return f > 0;
}

/** The 16 overlay shapes, TILE*TILE bytes each, 1 where the higher terrain covers the pixel. */
export const OVERLAY_MASKS: readonly Uint8Array[] = Array.from({ length: 16 }, (_, mask) => {
  const out = new Uint8Array(TILE * TILE);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) out[y * TILE + x] = covers(mask, x, y) ? 1 : 0;
  return out;
});

/**
 * Stamps the overlay for `layer` over every tile of a corner lattice (latticeW x latticeH,
 * row-major terrain layer indexes). Returns a pixel region of the tiles it spans.
 */
export function layerRegion(
  lattice: ArrayLike<number>,
  latticeW: number,
  latticeH: number,
  layer: number,
): Uint8Array {
  const w = (latticeW - 1) * TILE;
  const region = new Uint8Array(w * (latticeH - 1) * TILE);
  for (let ty = 0; ty < latticeH - 1; ty++) {
    for (let tx = 0; tx < latticeW - 1; tx++) {
      const at = (cx: number, cy: number) => lattice[cy * latticeW + cx]!;
      const mask = cornerMask(
        [at(tx, ty), at(tx + 1, ty), at(tx, ty + 1), at(tx + 1, ty + 1)],
        layer,
      );
      const shape = OVERLAY_MASKS[mask]!;
      for (let y = 0; y < TILE; y++) {
        region.set(shape.subarray(y * TILE, (y + 1) * TILE), (ty * TILE + y) * w + tx * TILE);
      }
    }
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
 * repeat the border pixel; region edges meet tile sides square-on, so that is a fair guess
 * for the unseen neighbour.
 */
export function edgeDistance(
  region: Uint8Array,
  w: number,
  h: number,
  reach: number,
): Float32Array {
  const offsets = offsetsWithin(reach);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = region[y * w + x]!;
      let d = Infinity;
      for (const [dx, dy, dist] of offsets) {
        const nx = Math.min(w - 1, Math.max(0, x + dx));
        const ny = Math.min(h - 1, Math.max(0, y + dy));
        if (region[ny * w + nx] !== inside) {
          d = dist;
          break;
        }
      }
      out[y * w + x] = inside ? -d : d;
    }
  }
  return out;
}
