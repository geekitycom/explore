import {
  LATTICE_H,
  LATTICE_W,
  OVERWORLD,
  PALETTE,
  SCREEN_PX_W,
  SCREEN_H,
  SCREEN_W,
  TERRAINS,
  TILE,
  type Feature,
  type Screen,
  type Terrain,
} from '@explore/core';
import { describe, expect, it } from 'vitest';
import { parseHex, toHex } from './color.ts';
import { TERRAIN_ART, composeTerrain, type TerrainTextures } from './terrain.ts';

const PLAIN: Record<Terrain, string> = {
  water: '#0000f0',
  sand: '#f0f000',
  dirt: '#804000',
  grass: '#00f000',
  darkgrass: '#006000',
  snow: '#f0f0f0',
};
const DECOR = '#ff00ff';

const solid = (hex: string) => {
  const texture = new Uint8ClampedArray(TILE * TILE * 4);
  for (let i = 0; i < TILE * TILE; i++) texture.set(parseHex(hex), i * 4);
  return texture;
};

const textures = Object.fromEntries(
  TERRAINS.map((t) => [t, TERRAIN_ART[t].fills.map((_, i) => solid(i === 0 ? PLAIN[t] : DECOR))]),
) as unknown as TerrainTextures;

function screenOf(terrainAt: (cx: number, cy: number) => Terrain): Screen {
  const corners: Terrain[] = [];
  for (let cy = 0; cy < LATTICE_H; cy++)
    for (let cx = 0; cx < LATTICE_W; cx++) corners.push(terrainAt(cx, cy));
  return {
    coord: { layer: OVERWORLD, sx: 3, sy: -2 },
    biome: 'meadow',
    corners,
    features: Array<Feature>(SCREEN_W * SCREEN_H).fill('none'),
  };
}

const hexAt = (pixels: Uint8ClampedArray, x: number, y: number) => {
  const o = (y * SCREEN_PX_W + x) * 4;
  return `#${[...pixels.subarray(o, o + 3)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

describe('composeTerrain', () => {
  it('fills a one-terrain screen with that terrain and no edge bands', () => {
    const pixels = composeTerrain(
      screenOf(() => 'dirt'),
      textures,
    );
    const colors = new Set<string>();
    for (let y = 0; y < SCREEN_H * TILE; y++)
      for (let x = 0; x < SCREEN_PX_W; x++) colors.add(hexAt(pixels, x, y));
    expect([...colors].sort()).toEqual([DECOR, PLAIN.dirt].sort());
  });

  it('draws sand, wet sand, bank, foam, shallows, then water outward from a shore', () => {
    const pixels = composeTerrain(
      screenOf((cx) => (cx <= 9 ? 'sand' : 'water')),
      textures,
    );
    const y = 7 * TILE + 3;
    const row = Array.from({ length: SCREEN_PX_W }, (_, x) => hexAt(pixels, x, y));
    const order = [
      PLAIN.sand,
      '#ffad5d',
      '#d78b4a',
      '#965340',
      '#ffffff',
      '#79b8ce',
      PLAIN.water,
    ].map((hex) => row.indexOf(hex));
    expect(order.every((x) => x >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(row.slice(0, 9 * TILE).every((hex) => hex === PLAIN.sand || hex === DECOR)).toBe(true);
    expect(row.slice(11 * TILE).every((hex) => hex === PLAIN.water || hex === DECOR)).toBe(true);
  });

  it('puts decorated fills only on tiles the terrain covers entirely', () => {
    const land = (cx: number, cy: number) => (cx + cy) % 7 < 4;
    const pixels = composeTerrain(
      screenOf((cx, cy) => (land(cx, cy) ? 'grass' : 'water')),
      textures,
    );
    let decorated = 0;
    for (let ty = 0; ty < SCREEN_H; ty++)
      for (let tx = 0; tx < SCREEN_W; tx++) {
        const centre = hexAt(pixels, tx * TILE + 8, ty * TILE + 8);
        if (centre !== DECOR) continue;
        decorated++;
        const corners = [land(tx, ty), land(tx + 1, ty), land(tx, ty + 1), land(tx + 1, ty + 1)];
        expect(new Set(corners).size, `tile ${tx},${ty}`).toBe(1);
      }
    expect(decorated).toBeGreaterThan(0);
  });

  it('joins darkgrass and snow to every other terrain with the higher edge band', () => {
    const pairs = TERRAINS.flatMap((upper, i) =>
      TERRAINS.slice(0, i).map((lower) => [upper, lower] as const),
    ).filter((pair) => pair.some((t) => t === 'darkgrass' || t === 'snow'));
    for (const [upper, lower] of pairs) {
      const pair = `${upper} over ${lower}`;
      const pixels = composeTerrain(
        screenOf((cx) => (cx <= 9 ? upper : lower)),
        textures,
      );
      const y = 7 * TILE + 3;
      const row = Array.from({ length: SCREEN_PX_W }, (_, x) => hexAt(pixels, x, y));
      const own = (t: Terrain) => (hex: string) => hex === PLAIN[t] || hex === DECOR;
      expect(row.slice(0, 8 * TILE).every(own(upper)), pair).toBe(true);
      expect(row.slice(12 * TILE).every(own(lower)), pair).toBe(true);
      for (const band of TERRAIN_ART[upper].inner) expect(row, pair).toContain(toHex(band.color));
      for (let x = 0; x < SCREEN_PX_W; x++) {
        expect(pixels[(y * SCREEN_PX_W + x) * 4 + 3], pair).toBe(255);
      }
    }
  }, 20_000);

  it('is deterministic for a screen', () => {
    const screen = screenOf((cx, cy) => TERRAINS[(cx * 3 + cy * 5) % TERRAINS.length]!);
    expect(composeTerrain(screen, textures)).toEqual(composeTerrain(screen, textures));
  });
});

describe('TERRAIN_ART', () => {
  it('draws every edge band in a palette colour', () => {
    const bands = Object.values(TERRAIN_ART).flatMap((art) => [...art.inner, ...art.outer]);
    for (const { color } of bands) expect(PALETTE).toContain(toHex(color).toUpperCase());
  });
});
