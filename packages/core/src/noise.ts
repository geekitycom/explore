/**
 * Every value is a pure function of its inputs, so screens computed separately agree on shared
 * points.
 */

function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function hash4(a: number, b: number, c: number, d: number): number {
  let h = mix(0x9e3779b9 ^ (a | 0));
  h = mix(h ^ (b | 0));
  h = mix(h ^ (c | 0));
  return mix(h ^ (d | 0));
}

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return mix(h);
}

export function unit(h: number): number {
  return (h >>> 0) / 4294967296;
}

export type Noise2 = (x: number, y: number) => number;

const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Smoothly interpolated value noise with one random value per integer lattice point, in [0, 1). */
export function valueNoise(seed: number): Noise2 {
  const at = (ix: number, iy: number) => unit(hash4(seed, ix, iy, 0));
  // Successive samples mostly fall in the same cell, so its corners are kept.
  let cellX = NaN;
  let cellY = NaN;
  let [nw, ne, sw, se] = [0, 0, 0, 0];
  return (x, y) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix !== cellX || iy !== cellY) {
      [nw, ne, sw, se] = [at(ix, iy), at(ix + 1, iy), at(ix, iy + 1), at(ix + 1, iy + 1)];
      [cellX, cellY] = [ix, iy];
    }
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const top = nw + (ne - nw) * fx;
    const bottom = sw + (se - sw) * fx;
    return top + (bottom - top) * fy;
  };
}

export type FbmParams = {
  readonly wavelength: number;
  readonly octaves: number;
  readonly gain?: number;
  readonly lacunarity?: number;
};

/**
 * Fractal Brownian motion: octaves of value noise, each with half the wavelength and `gain`
 * times the amplitude of the last, normalised back to [0, 1).
 */
export function fbm(
  seed: number,
  { wavelength, octaves, gain = 0.5, lacunarity = 2 }: FbmParams,
): Noise2 {
  const layers = Array.from({ length: octaves }, (_, i) => ({
    noise: valueNoise(hash4(seed, i, 0, 0)),
    frequency: lacunarity ** i / wavelength,
    amplitude: gain ** i,
  }));
  const total = layers.reduce((sum, l) => sum + l.amplitude, 0);
  return (x, y) => {
    let sum = 0;
    for (const { noise, frequency, amplitude } of layers) {
      sum += noise(x * frequency, y * frequency) * amplitude;
    }
    return sum / total;
  };
}

export function warped(noise: Noise2, seed: number, amplitude: number, wavelength: number): Noise2 {
  const dx = fbm(hash4(seed, 1, 0, 0), { wavelength, octaves: 2 });
  const dy = fbm(hash4(seed, 2, 0, 0), { wavelength, octaves: 2 });
  return (x, y) =>
    noise(x + (dx(x, y) - 0.5) * 2 * amplitude, y + (dy(x, y) - 0.5) * 2 * amplitude);
}
