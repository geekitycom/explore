import { describe, expect, test } from 'vitest';
import { BIOME_RAMPS, OUTLINE, PALETTE, PALETTE_BIOMES, RAMPS, type Hex } from './palette.ts';

const NINJA_ADVENTURE_PALETTE = [
  '#D78B4A', '#FFAD5D', '#FFBC75', '#D2B37D', '#F1C471', '#FFCB8D', '#EECF9B', '#FFE18D',
  '#FCE2CA', '#FFFFFF', '#965340', '#9C6546', '#A3754E', '#BD7959', '#D3865F', '#C8966B',
  '#F2AD7D', '#FFCBA9', '#D14B34', '#E46D3A', '#EF914F', '#FF9554', '#E0394C', '#CF736D',
  '#EF9597', '#4A5270', '#2D697B', '#548789', '#79B8CE', '#71DDEE', '#8FEFF1', '#B8DCE5',
  '#F2EAF1', '#56864C', '#74A334', '#A8A129', '#ADBC3A', '#3B3643', '#543C52', '#8F3E56',
  '#A5608B', '#D3A2C0', '#345A52', '#5F7160', '#8D977F', '#ABC2BC', '#141B1B', '#4E484A',
  '#695953', '#816855', '#90775E', '#8E7C73', '#B3957F',
]; // prettier-ignore

/** Colours the task-33 recipe spike added; the pack's own sheets use some of them. */
const SPIKE_ADDITIONS = [
  '#23403C',
  '#4A7F4B',
  '#7B473C',
  '#2A4B3F',
  '#3F6E4C',
  '#7FA24A',
  '#D5D66B',
];

function luminance(hex: Hex): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

describe('master palette', () => {
  test('has 64 unique uppercase colours across 18 ramps', () => {
    expect(PALETTE).toHaveLength(64);
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
    for (const hex of PALETTE) expect(hex).toMatch(/^#[0-9A-F]{6}$/);
    expect(Object.keys(RAMPS)).toHaveLength(18);
  });

  test('keeps every Ninja Adventure colour and every spike addition', () => {
    expect(PALETTE).toEqual(
      expect.arrayContaining([...NINJA_ADVENTURE_PALETTE, ...SPIKE_ADDITIONS]),
    );
  });

  test('the outline is the darkest colour and sits in no ramp', () => {
    for (const hex of PALETTE) expect(luminance(hex)).toBeGreaterThanOrEqual(luminance(OUTLINE));
    for (const ramp of Object.values(RAMPS)) expect(ramp).not.toContain(OUTLINE);
  });

  test.each(Object.entries(RAMPS))('%s runs 4 to 6 steps, strictly dark to light', (_, ramp) => {
    expect(ramp.length).toBeGreaterThanOrEqual(4);
    expect(ramp.length).toBeLessThanOrEqual(6);
    const steps = ramp.map(luminance);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]!);
  });

  test('every biome names ramps for its ground and its flora', () => {
    expect(Object.keys(BIOME_RAMPS).sort()).toEqual([...PALETTE_BIOMES].sort());
    for (const { ground, flora } of Object.values(BIOME_RAMPS)) {
      expect(ground.length).toBeGreaterThan(0);
      expect(flora.length).toBeGreaterThan(0);
      for (const name of [...ground, ...flora]) expect(RAMPS).toHaveProperty(name);
    }
  });
});
