import { decode } from 'jpeg-js';
import type {
  BiomePhoto,
  BiomePhotoPalette,
  PhotoCluster,
  RampProposal,
} from '../src/biome-photo-palettes.ts';
import {
  OUTLINE,
  PALETTE,
  PALETTE_BIOMES,
  RAMPS,
  type Hex,
  type PaletteBiome,
  type RampName,
} from '../src/palette.ts';

/** A colour in OKLab, where Euclidean distance tracks perceived difference. */
export type Lab = readonly [number, number, number];

/** Pixels in OKLab with a weight each, so every photo counts equally however big it is. */
export type Samples = { readonly labs: readonly Lab[]; readonly weights: readonly number[] };

function toLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function fromLinear(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function labToHex([L, a, b]: Lab): Hex {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(fromLinear);
  return `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase() as Hex;
}

export function hexToLab(hex: Hex): Lab {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgbToLab(n >> 16, (n >> 8) & 255, n & 255);
}

function distance(p: Lab, q: Lab): number {
  return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
}

function nearest(point: Lab, centres: readonly Lab[]): number {
  let best = 0;
  for (let i = 1; i < centres.length; i++) {
    if (distance(point, centres[i]!) < distance(point, centres[best]!)) best = i;
  }
  return best;
}

/**
 * Weighted k-means. Centres start at weighted lightness quantiles, so the result is the same on
 * every run. Returns each non-empty cluster's mean and its share of the total weight.
 */
export function kmeans(
  { labs, weights }: Samples,
  k: number,
  iterations = 30,
): { readonly centre: Lab; readonly share: number }[] {
  const byLightness = labs.map((_, i) => i).sort((i, j) => labs[i]![0] - labs[j]![0]);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let centres: Lab[] = [];
  let seen = 0;
  for (const i of byLightness) {
    seen += weights[i]!;
    while (centres.length < k && seen >= ((centres.length + 0.5) / k) * total) {
      centres.push(labs[i]!);
    }
  }

  let assignment: number[] = [];
  for (let step = 0; step < iterations; step++) {
    const next = labs.map((lab) => nearest(lab, centres));
    if (next.every((c, i) => c === assignment[i])) break;
    assignment = next;
    const sums = centres.map(() => [0, 0, 0, 0]);
    labs.forEach((lab, i) => {
      const sum = sums[assignment[i]!]!;
      const w = weights[i]!;
      sum[0]! += lab[0] * w;
      sum[1]! += lab[1] * w;
      sum[2]! += lab[2] * w;
      sum[3]! += w;
    });
    centres = centres.map((centre, c) => {
      const [l, a, b, w] = sums[c]!;
      return w! > 0 ? [l! / w!, a! / w!, b! / w!] : centre;
    });
  }

  const shares = centres.map(() => 0);
  assignment.forEach((c, i) => (shares[c]! += weights[i]! / total));
  return centres
    .map((centre, c) => ({ centre, share: shares[c]! }))
    .filter(({ share }) => share > 0)
    .sort((p, q) => q.share - p.share);
}

const RAMP_COLOURS = PALETTE.filter((hex) => hex !== OUTLINE);
const RAMP_LABS = RAMP_COLOURS.map(hexToLab);

/** The nearest ramp colour. The outline is never a snap target: it is not a material. */
export function snap(lab: Lab): Hex {
  return RAMP_COLOURS[nearest(lab, RAMP_LABS)]!;
}

const DARKEST = Math.min(...RAMP_LABS.map(([L]) => L));

/**
 * Pixel art is brighter and more saturated than a photo, and has no black: its darkest step is the
 * darkest ramp colour. So before snapping, lightness maps into the ramps' range and chroma scales
 * up by `chroma`.
 */
export function clusterSamples(samples: Samples, k: number, chroma: number): PhotoCluster[] {
  return kmeans(samples, k).map(({ centre: [L, a, b], share }) => ({
    colour: labToHex([L, a, b]),
    snapped: snap([DARKEST + L * (1 - DARKEST), a * chroma, b * chroma]),
    share,
  }));
}

/**
 * Greedy cover: repeatedly take the ramp whose colours cover the most pixel share not yet covered,
 * until no ramp adds at least `minShare`. A colour shared by several ramps counts once, for the
 * first ramp taken that holds it; on a tie the shorter, more specific ramp wins.
 */
export function proposeRamps(clusters: readonly PhotoCluster[], minShare = 0.02): RampProposal[] {
  const uncovered = new Map<Hex, number>();
  for (const { snapped, share } of clusters) {
    uncovered.set(snapped, (uncovered.get(snapped) ?? 0) + share);
  }
  const gain = (ramp: RampName) =>
    RAMPS[ramp].reduce((sum, hex: Hex) => sum + (uncovered.get(hex) ?? 0), 0);
  const better = (p: RampName, q: RampName) =>
    gain(q) - gain(p) > 1e-9 ||
    (Math.abs(gain(q) - gain(p)) <= 1e-9 && RAMPS[q].length < RAMPS[p].length);
  const names = Object.keys(RAMPS) as RampName[];
  const proposals: RampProposal[] = [];
  for (;;) {
    const best = names.reduce((p, q) => (better(p, q) ? q : p));
    const share = gain(best);
    if (share < minShare) return proposals;
    proposals.push({ ramp: best, share });
    for (const hex of RAMPS[best]) uncovered.delete(hex);
  }
}

const CLUSTERS = 12;
const CHROMA = 1.8;
const LICENCES = ['Public domain', 'CC0'];

/** A reference photo: its attribution, where its thumbnail lives, and how much sky to crop. */
export type PhotoSource = BiomePhoto & {
  readonly biome: PaletteBiome;
  readonly file: string;
  readonly thumbnail: string;
  readonly skipTop?: number;
};

export function parseSources(raw: unknown): PhotoSource[] {
  if (!Array.isArray(raw)) throw new Error('sources.json must be an array');
  for (const s of raw as PhotoSource[]) {
    if (!PALETTE_BIOMES.includes(s.biome)) throw new Error(`${s.file}: unknown biome ${s.biome}`);
    if (!LICENCES.includes(s.licence)) throw new Error(`${s.file}: ${s.licence} is not PD or CC0`);
    for (const key of ['file', 'source', 'thumbnail', 'author'] as const) {
      if (typeof s[key] !== 'string' || !s[key]) throw new Error(`${s.file}: missing ${key}`);
    }
  }
  return raw as PhotoSource[];
}

/** Every pixel below the cropped sky band, weighted so each photo totals 1. */
function photoSamples(jpeg: Uint8Array, skipTop = 0): Samples {
  const { width, height, data } = decode(jpeg, { useTArray: true, formatAsRGBA: true });
  const labs: Lab[] = [];
  for (let y = Math.round(height * skipTop); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      labs.push(rgbToLab(data[i]!, data[i + 1]!, data[i + 2]!));
    }
  }
  return { labs, weights: labs.map(() => 1 / labs.length) };
}

const round = (share: number) => Math.round(share * 1000) / 1000;

/** One biome's palette from its photos and their JPEG bytes, given in the same order. */
export function biomePalette(
  photos: readonly PhotoSource[],
  jpegs: readonly Uint8Array[],
): BiomePhotoPalette {
  const samples = photos.map((photo, i) => photoSamples(jpegs[i]!, photo.skipTop));
  const clusters = clusterSamples(
    { labs: samples.flatMap((s) => s.labs), weights: samples.flatMap((s) => s.weights) },
    CLUSTERS,
    CHROMA,
  );
  return {
    photos: photos.map(({ source, author, licence }) => ({ source, author, licence })),
    clusters: clusters.map((c) => ({ ...c, share: round(c.share) })),
    ramps: proposeRamps(clusters).map((r) => ({ ...r, share: round(r.share) })),
  };
}
