export type Rgba = readonly [number, number, number, number];

/** RGBA bytes that ImageData accepts. */
export type Pixels = Uint8ClampedArray<ArrayBuffer>;

export function parseHex(hex: string, alpha = 255): Rgba {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
}

export function toHex([r, g, b]: Rgba): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Linear blend of `a` toward `b` by `t` in 0..1; alpha follows `a`. */
export function mix(a: Rgba, b: Rgba, t: number): Rgba {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
    a[3],
  ];
}

/** Source-over of `color` (with its alpha) onto the opaque pixel at `offset`. */
export function paint(pixels: Uint8ClampedArray, offset: number, color: Rgba): void {
  const a = color[3] / 255;
  pixels[offset] = pixels[offset]! + (color[0] - pixels[offset]!) * a;
  pixels[offset + 1] = pixels[offset + 1]! + (color[1] - pixels[offset + 1]!) * a;
  pixels[offset + 2] = pixels[offset + 2]! + (color[2] - pixels[offset + 2]!) * a;
  pixels[offset + 3] = 255;
}
