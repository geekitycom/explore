import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  LATTICE_H,
  LATTICE_W,
  SCREEN_H,
  SCREEN_W,
  type Feature,
  type Terrain,
} from '../src/world.ts';
import { BIOME_RGB, TERRAIN_RGB, renderPreview, type PreviewOptions } from './render-preview.ts';
import { fieldsSource, type WorldSource } from './world-source.ts';

const options: PreviewOptions = {
  area: { x0: -1, y0: -1, w: 3, h: 3 },
  mode: 'terrain',
  overlays: new Set(['roads', 'pois']),
  scale: 1,
  grid: true,
};

function pixelAt(png: Buffer, x: number, y: number): number[] {
  let width = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') width = data.readUInt32BE(0);
    if (type === 'IDAT') idat.push(data);
    at += length + 12;
  }
  const rows = inflateSync(Buffer.concat(idat));
  const row = y * (width * 3 + 1);
  expect(rows[row]).toBe(0);
  return [...rows.subarray(row + 1 + x * 3, row + 4 + x * 3)];
}

describe('world preview', () => {
  it('renders the same bytes for the same seed and area', () => {
    const a = renderPreview(fieldsSource(7), options).png;
    const b = renderPreview(fieldsSource(7), options).png;
    expect(a.equals(b)).toBe(true);
    expect(a.equals(renderPreview(fieldsSource(8), options).png)).toBe(false);
  });

  it('colours tiles by biome in biome mode', () => {
    const biomes = ['garden', 'desert', 'taiga', 'tundra'];
    const source: WorldSource = {
      name: 'one biome per screen',
      screen: (sx, sy) => ({
        corners: Array<Terrain>(LATTICE_W * LATTICE_H).fill('grass'),
        features: Array<Feature>(SCREEN_W * SCREEN_H).fill('none'),
        biomes: Array<string>(SCREEN_W * SCREEN_H).fill(biomes[sx + 2 * sy]!),
      }),
    };
    const { png, stats } = renderPreview(source, {
      ...options,
      area: { x0: 0, y0: 0, w: 2, h: 2 },
      mode: 'biome',
      overlays: new Set(),
    });
    expect(stats.screensWithoutBiome).toBe(0);
    for (const [i, biome] of biomes.entries()) {
      const [sx, sy] = [i % 2, Math.floor(i / 2)];
      expect(pixelAt(png, sx * SCREEN_W + 3, sy * SCREEN_H + 3)).toEqual(BIOME_RGB[biome]);
    }
  });

  it('gives every tile of the seeded fields a biome, several across the world', () => {
    const source = fieldsSource(1);
    expect(new Set(source.screen(0, 0).biomes)).toEqual(new Set(['garden']));
    const seen = new Set<string>();
    for (let sy = -8; sy < 8; sy += 2) {
      for (let sx = -8; sx < 8; sx += 2) {
        const { biomes = [] } = source.screen(sx, sy);
        expect(biomes).toHaveLength(SCREEN_W * SCREEN_H);
        for (const biome of biomes) seen.add(biome);
      }
    }
    expect([...seen].filter((biome) => !(biome in BIOME_RGB))).toEqual([]);
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it('draws the garden pond at screen 0,0', () => {
    const { png, stats } = renderPreview(fieldsSource(1), { ...options, overlays: new Set() });
    expect([stats.width, stats.height]).toEqual([3 * SCREEN_W, 3 * SCREEN_H]);
    expect(pixelAt(png, SCREEN_W + 9, SCREEN_H + 7)).toEqual([...TERRAIN_RGB.water]);
  });
});
