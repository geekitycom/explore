import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { BIOME_PHOTO_PALETTES } from '../src/biome-photo-palettes.ts';
import { OUTLINE, PALETTE, PALETTE_BIOMES, RAMPS } from '../src/palette.ts';
import {
  biomePalette,
  hexToLab,
  kmeans,
  labToHex,
  parseSources,
  proposeRamps,
  snap,
} from './photo-palette.ts';

const PHOTOS = resolve(import.meta.dirname, 'biome-photos');
const sources = parseSources(JSON.parse(readFileSync(resolve(PHOTOS, 'sources.json'), 'utf8')));

describe('photo palette tool', () => {
  test('OKLab round-trips every palette colour', () => {
    for (const hex of PALETTE) expect(labToHex(hexToLab(hex))).toBe(hex);
  });

  test('k-means finds weighted cluster means and shares', () => {
    const dark = hexToLab('#202020');
    const light = hexToLab('#E0E0E0');
    const clusters = kmeans({ labs: [dark, dark, light], weights: [0.1, 0.1, 0.8] }, 2);
    expect(clusters.map((c) => labToHex(c.centre))).toEqual(['#E0E0E0', '#202020']);
    expect(clusters.map((c) => c.share)).toEqual([0.8, 0.2]);
  });

  test('snaps to the nearest ramp colour, never the outline', () => {
    expect(snap(hexToLab('#75A235'))).toBe('#74A334');
    const black = snap(hexToLab('#000000'));
    expect(black).not.toBe(OUTLINE);
    expect(PALETTE).toContain(black);
  });

  test('proposes ramps by greedy cover, counting a shared colour once', () => {
    const cluster = (snapped: `#${string}`, share: number) => ({ colour: snapped, snapped, share });
    expect(
      proposeRamps([cluster('#74A334', 0.5), cluster('#D5D66B', 0.3), cluster('#23403C', 0.2)]),
    ).toEqual([
      { ramp: 'grass', share: 0.8 },
      { ramp: 'pine', share: 0.2 },
    ]);
  });

  test('a colour several ramps share goes to the shortest of them', () => {
    const shared = { colour: '#345A52', snapped: '#345A52', share: 1 } as const;
    expect(RAMPS.grass).toContain(shared.snapped);
    expect(proposeRamps([shared])).toEqual([{ ramp: 'pine', share: 1 }]);
  });

  test('every reference photo is PD or CC0, attributed, and on disk', () => {
    expect(new Set(sources.map((s) => s.biome))).toEqual(new Set(PALETTE_BIOMES));
    for (const s of sources) {
      expect(['Public domain', 'CC0']).toContain(s.licence);
      expect(s.source).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(s.author).not.toBe('');
      expect(() => readFileSync(resolve(PHOTOS, s.file))).not.toThrow();
    }
  });

  test('rejects a photo that is not PD or CC0', () => {
    const [photo] = sources;
    expect(() => parseSources([{ ...photo, licence: 'CC BY-SA 4.0' }])).toThrow(/not PD or CC0/);
  });

  // A fresh run is some 100 ms of k-means per biome, so it runs here, outside the tests' time.
  const fresh = new Map(
    PALETTE_BIOMES.map((biome) => {
      const photos = sources.filter((s) => s.biome === biome);
      const jpegs = photos.map((s) => readFileSync(resolve(PHOTOS, s.file)));
      return [biome, biomePalette(photos, jpegs)];
    }),
  );

  test.each(PALETTE_BIOMES)(
    'the committed %s palette matches a fresh run over the committed photos',
    (biome) => {
      expect(fresh.get(biome)).toEqual(BIOME_PHOTO_PALETTES[biome]);
    },
  );

  test('every committed snap and proposal names the master palette', () => {
    for (const { clusters, ramps } of Object.values(BIOME_PHOTO_PALETTES)) {
      for (const { snapped } of clusters) expect(PALETTE).toContain(snapped);
      for (const { ramp } of ramps) expect(RAMPS).toHaveProperty(ramp);
    }
  });
});
