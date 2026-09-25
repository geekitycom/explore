import { OUTLINE, RAMPS, type Hex, type RampName } from '../palette.ts';
import { SHADOW, type Sprite } from '../sprite.ts';

export type Ramp = readonly Hex[];

export function ramp(name: RampName): Ramp {
  return RAMPS[name];
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The ramp colour a brightness `v` in 0..1 falls on. */
export function step(r: Ramp, v: number): Hex {
  return r[clamp(Math.floor(v * r.length), 0, r.length - 1)]!;
}

/** `count` colours spread evenly from `r[from]` to the lightest. */
export function spread(r: Ramp, count: number, from = 0): Ramp {
  const last = r.length - 1;
  if (count <= 1) return [r[last]!];
  return Array.from(
    { length: count },
    (_, i) => r[Math.round(from + ((last - from) * i) / (count - 1))]!,
  );
}

/** A mask of which pixels belong to a shape, row-major. */
export class Mask {
  readonly bits: Uint8Array;
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.bits = new Uint8Array(width * height);
  }
  has(x: number, y: number): boolean {
    return (
      x >= 0 && y >= 0 && x < this.width && y < this.height && this.bits[y * this.width + x] === 1
    );
  }
  add(x: number, y: number): void {
    if (x >= 0 && y >= 0 && x < this.width && y < this.height) this.bits[y * this.width + x] = 1;
  }
  ellipse(cx: number, cy: number, rx: number, ry = rx): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.add(x, y);
      }
    }
  }
  /** Off the border, which stays free for the outline. */
  interior(x: number, y: number): boolean {
    return x > 0 && y > 0 && x < this.width - 1 && y < this.height - 1;
  }
  /** Drops pixels sticking out alone and fills notches, so silhouettes read as solid. */
  smooth(passes = 2): void {
    for (let p = 0; p < passes; p++) {
      const next = this.bits.slice();
      for (let y = 0; y < this.height; y++) {
        for (let x = 0; x < this.width; x++) {
          const n =
            Number(this.has(x - 1, y)) +
            Number(this.has(x + 1, y)) +
            Number(this.has(x, y - 1)) +
            Number(this.has(x, y + 1));
          if (this.has(x, y) && n <= 1) next[y * this.width + x] = 0;
          if (!this.has(x, y) && n >= 3 && this.interior(x, y)) next[y * this.width + x] = 1;
        }
      }
      this.bits.set(next);
    }
  }
  bounds(): { top: number; bottom: number; left: number; right: number } {
    let top = this.height;
    let bottom = -1;
    let left = this.width;
    let right = -1;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.has(x, y)) continue;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        left = Math.min(left, x);
        right = Math.max(right, x);
      }
    }
    return { top, bottom, left, right };
  }
}

/** A sprite being drawn: palette colours or empty per pixel, plus a ground shadow. */
export class Canvas {
  private readonly cells: (Hex | null)[];
  private readonly shade: Mask;
  readonly width: number;
  readonly height: number;
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = Array<Hex | null>(width * height).fill(null);
    this.shade = new Mask(width, height);
  }
  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }
  get(x: number, y: number): Hex | null {
    return this.inside(x, y) ? this.cells[y * this.width + x]! : null;
  }
  set(x: number, y: number, colour: Hex | null): void {
    if (this.inside(x, y)) this.cells[y * this.width + x] = colour;
  }
  /** Replaces a pixel that differs from all of its four neighbours with their commonest colour. */
  despeckle(): void {
    const next = this.cells.slice();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const c = this.get(x, y);
        if (!c) continue;
        const ns = [this.get(x - 1, y), this.get(x + 1, y), this.get(x, y - 1), this.get(x, y + 1)];
        const filled = ns.filter((n): n is Hex => n !== null);
        if (filled.length < 4 || filled.includes(c)) continue;
        const counts = new Map<Hex, number>();
        for (const n of filled) counts.set(n, (counts.get(n) ?? 0) + 1);
        next[y * this.width + x] = [...counts].sort((a, b) => b[1] - a[1])[0]![0];
      }
    }
    this.cells.splice(0, this.cells.length, ...next);
  }
  /** The full 1px dark outline round every filled pixel. */
  outline(): void {
    const edge: [number, number][] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) {
          edge.push([x, y]);
        }
      }
    }
    for (const [x, y] of edge) this.set(x, y, OUTLINE);
  }
  shadow(cx: number, cy: number, rx: number, ry: number): void {
    this.shade.ellipse(cx, cy, rx, ry);
  }
  /** Anchored bottom-centre: the sprite's bottom edge sits on the tile's bottom edge. */
  toSprite(): Sprite {
    const rgba = new Uint8ClampedArray(this.width * this.height * 4);
    const put = (i: number, hex: Hex, alpha: number) => {
      const n = Number.parseInt(hex.slice(1), 16);
      rgba.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha], i * 4);
    };
    this.cells.forEach((c, i) => {
      if (c) put(i, c, 255);
      else if (this.shade.bits[i]) put(i, SHADOW.color, SHADOW.alpha);
    });
    return {
      width: this.width,
      height: this.height,
      anchor: { x: this.width / 2, y: this.height },
      rgba,
    };
  }
}
