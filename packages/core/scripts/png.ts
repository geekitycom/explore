import { crc32, deflateSync, inflateSync } from 'node:zlib';
import type { PixelImage } from '../src/sprite.ts';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const RGB = 2;
const RGBA = 6;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decodes a non-interlaced 8-bit RGBA PNG, the only kind the pack ships. */
export function decodePng(png: Buffer): PixelImage {
  if (!png.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG');
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, colour, , , interlace] = data.subarray(8);
      if (depth !== 8 || colour !== RGBA || interlace !== 0) {
        throw new Error(
          `unsupported PNG: depth ${depth}, colour type ${colour}, interlace ${interlace}`,
        );
      }
    }
    if (type === 'IDAT') idat.push(data);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = new Uint8ClampedArray(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const row = y * stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x]!;
      const left = x >= 4 ? rgba[row + x - 4]! : 0;
      const up = y > 0 ? rgba[row - stride + x]! : 0;
      const upLeft = x >= 4 && y > 0 ? rgba[row - stride + x - 4]! : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      if (predictor === undefined) throw new Error(`bad PNG filter ${filter}`);
      rgba[row + x] = (v + predictor) & 255;
    }
  }
  return { width, height, rgba };
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encode(
  width: number,
  height: number,
  colourType: number,
  channels: number,
  pixels: Uint8Array | Uint8ClampedArray,
  level?: number,
): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, colourType, 0, 0, 0], 8);
  const stride = width * channels;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++)
    rows.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** An 8-bit RGBA PNG with no row filtering. */
export function encodePng({ width, height, rgba }: PixelImage): Buffer {
  return encode(width, height, RGBA, 4, rgba, 9);
}

/** An 8-bit RGB PNG with no row filtering. */
export function encodeRgbPng(width: number, height: number, rgb: Uint8Array): Buffer {
  return encode(width, height, RGB, 3, rgb);
}
