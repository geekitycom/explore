import {
  LATTICE_H,
  LATTICE_W,
  SCREEN_H,
  SCREEN_PX_H,
  SCREEN_PX_W,
  SCREEN_W,
  TERRAINS,
  TILE,
  type Screen,
  type Terrain,
} from '@explore/core';
import { paint, parseHex, type Pixels, type Rgba } from './color.ts';
import { cornerMask, edgeDistance, layerRegion } from './mask.ts';
import { cell, tileHash, type SpriteRef } from './sheets.ts';
import type { Art } from './load.ts';

/** A band of color along a terrain edge, covering pixels whose edge distance is below `upTo`. */
type Ring = { readonly upTo: number; readonly color: Rgba };

type TerrainArt = {
  /** Plain fill first, then decorated variants. */
  readonly fills: readonly SpriteRef[];
  /** Chance a fully covered tile takes a decorated variant instead of the plain fill. */
  readonly decorChance: number;
  /** Bands just inside the terrain's edge, innermost last. */
  readonly inner: readonly Ring[];
  /** Bands just outside the edge, drawn over the terrains below, nearest first. */
  readonly outer: readonly Ring[];
};

const ring = (upTo: number, hex: string, alpha = 255): Ring => ({
  upTo,
  color: parseHex(hex, alpha),
});

export const TERRAIN_ART: Record<Terrain, TerrainArt> = {
  water: {
    fills: [
      cell('water', 1, 7),
      cell('water', 11, 1),
      cell('water', 11, 2),
      cell('water', 11, 3),
      cell('water', 11, 4),
    ],
    decorChance: 0.05,
    inner: [],
    outer: [],
  },
  sand: {
    fills: [cell('floor', 1, 1), cell('floor', 0, 4), cell('floor', 1, 4)],
    decorChance: 0.05,
    inner: [ring(1.5, '#d78b4a'), ring(3.1, '#ffad5d')],
    outer: [ring(1.5, '#965340'), ring(3.1, '#ffffff'), ring(4.1, '#79b8ce')],
  },
  dirt: {
    fills: [cell('floor', 1, 8), cell('floor', 0, 11), cell('floor', 1, 11)],
    decorChance: 0.08,
    inner: [ring(1.2, '#a3754e')],
    outer: [ring(1.2, '#7b473c', 70)],
  },
  grass: {
    fills: [
      cell('floor', 0, 12),
      cell('floor', 1, 12),
      cell('floor', 2, 12),
      cell('floor', 3, 12),
      cell('floor', 4, 12),
    ],
    decorChance: 0.15,
    inner: [ring(1.2, '#a8a129')],
    outer: [ring(1.5, '#4e484a', 70)],
  },
  darkgrass: {
    fills: [
      cell('floor', 11, 12),
      cell('floor', 12, 12),
      cell('floor', 13, 12),
      cell('floor', 14, 12),
      cell('floor', 15, 12),
    ],
    decorChance: 0.15,
    inner: [ring(1.2, '#56864c')],
    outer: [ring(1.5, '#2a4b3f', 70)],
  },
  snow: {
    fills: [cell('floor', 1, 15), cell('floor', 0, 18), cell('floor', 1, 18)],
    decorChance: 0.04,
    inner: [ring(1.2, '#d2c9c9'), ring(2.6, '#f2eaf1')],
    outer: [ring(1.5, '#4a5270', 60)],
  },
};

/** A tile's pixels (TILE*TILE RGBA) for each fill of each terrain, in TERRAIN_ART order. */
export type TerrainTextures = Readonly<Record<Terrain, readonly Uint8ClampedArray[]>>;

const RING_REACH = 5;

export function fillIndex(
  screen: Screen,
  tx: number,
  ty: number,
  layer: number,
  terrain: TerrainArt,
) {
  const h = tileHash(screen.coord, tx, ty, layer);
  if ((h & 0xffff) / 0x10000 >= terrain.decorChance) return 0;
  return 1 + ((h >>> 16) % (terrain.fills.length - 1));
}

function ringColor(rings: readonly Ring[], distance: number): Rgba | undefined {
  return rings.find((r) => distance < r.upTo)?.color;
}

/**
 * The screen's terrain as SCREEN_PX_W x SCREEN_PX_H RGBA. Water fills everything, then each
 * higher terrain is laid over the region its corner masks cover, with its edge bands.
 */
export function composeTerrain(screen: Screen, textures: TerrainTextures): Pixels {
  const lattice = screen.corners.map((t) => TERRAINS.indexOf(t));
  const out = new Uint8ClampedArray(SCREEN_PX_W * SCREEN_PX_H * 4);
  const tileLayers = (tx: number, ty: number) => {
    const at = (cx: number, cy: number) => lattice[cy * LATTICE_W + cx]!;
    return [at(tx, ty), at(tx + 1, ty), at(tx, ty + 1), at(tx + 1, ty + 1)] as const;
  };

  TERRAINS.forEach((terrain, layer) => {
    const art = TERRAIN_ART[terrain];
    const region = layer === 0 ? undefined : layerRegion(lattice, LATTICE_W, LATTICE_H, layer);
    const distance = region && edgeDistance(region, SCREEN_PX_W, SCREEN_PX_H, RING_REACH);
    for (let ty = 0; ty < SCREEN_H; ty++) {
      for (let tx = 0; tx < SCREEN_W; tx++) {
        const corners = tileLayers(tx, ty);
        const full = layer === 0 ? cornerMask(corners, 1) === 0 : cornerMask(corners, layer) === 15;
        const texture = textures[terrain][full ? fillIndex(screen, tx, ty, layer, art) : 0]!;
        for (let y = 0; y < TILE; y++) {
          for (let x = 0; x < TILE; x++) {
            const px = (ty * TILE + y) * SCREEN_PX_W + tx * TILE + x;
            const o = px * 4;
            const d = distance ? distance[px]! : -Infinity;
            if (d < 0) {
              const color = ringColor(art.inner, -d);
              if (color) paint(out, o, color);
              else out.set(texture.subarray((y * TILE + x) * 4, (y * TILE + x) * 4 + 4), o);
            } else {
              const color = ringColor(art.outer, d);
              if (color) paint(out, o, color);
            }
          }
        }
      }
    }
  });
  return out;
}

export function bakeTerrain(screen: Screen, art: Art): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_PX_W;
  canvas.height = SCREEN_PX_H;
  const pixels = composeTerrain(screen, art.terrain);
  canvas.getContext('2d')!.putImageData(new ImageData(pixels, SCREEN_PX_W, SCREEN_PX_H), 0, 0);
  return canvas;
}
