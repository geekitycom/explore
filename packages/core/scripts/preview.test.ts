import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { SCREEN_H, SCREEN_W } from '../src/world.ts';
import { BIOME_RGB, TERRAIN_RGB, renderPreview, type PreviewOptions } from './render-preview.ts';
import { fieldsSource } from './world-source.ts';

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
    const area = { x0: -12, y0: -12, w: 24, h: 24 };
    const { png, stats } = renderPreview(fieldsSource(1), { ...options, area, mode: 'biome' });
    expect(stats.screensWithoutBiome).toBe(0);
    const at = (sx: number, sy: number) =>
      pixelAt(png, (sx - area.x0) * SCREEN_W + 3, (sy - area.y0) * SCREEN_H + 3).join();
    expect(at(0, 0)).toBe(BIOME_RGB.garden!.join());
    const palette = new Set(Object.values(BIOME_RGB).map((rgb) => rgb.join()));
    const seen = new Set<string>();
    for (let sy = area.y0; sy < area.y0 + area.h; sy += 2) {
      for (let sx = area.x0; sx < area.x0 + area.w; sx += 2) seen.add(at(sx, sy));
    }
    expect([...seen].every((rgb) => palette.has(rgb))).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it('draws the garden pond at screen 0,0', () => {
    const { png, stats } = renderPreview(fieldsSource(1), { ...options, overlays: new Set() });
    expect([stats.width, stats.height]).toEqual([3 * SCREEN_W, 3 * SCREEN_H]);
    expect(pixelAt(png, SCREEN_W + 9, SCREEN_H + 7)).toEqual([...TERRAIN_RGB.water]);
  });
});
