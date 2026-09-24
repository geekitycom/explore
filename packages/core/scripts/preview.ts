import { writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { growWorld } from '../src/testing.ts';
import {
  SCREEN_H,
  SCREEN_W,
  cornerAt,
  featureAt,
  type Feature,
  type Terrain,
} from '../src/world.ts';

const [seedArg = '1', countArg = '80', out = 'world-preview.png'] = process.argv.slice(2);
const PX = 8;

const TERRAIN_RGB: Record<Terrain, [number, number, number]> = {
  water: [52, 101, 164],
  sand: [222, 201, 140],
  dirt: [150, 108, 70],
  grass: [106, 170, 72],
};
const FEATURE_RGB: Record<Feature, [number, number, number] | undefined> = {
  none: undefined,
  tree: [28, 84, 40],
  bush: [60, 120, 50],
  rock: [128, 128, 128],
  flowers: [230, 120, 170],
  tallgrass: [140, 196, 90],
};

const { world } = growWorld(Number(seedArg), Number(countArg));
const coords = [...world.values()].map((s) => s.coord);
const minX = Math.min(...coords.map((c) => c.sx));
const minY = Math.min(...coords.map((c) => c.sy));
const width = (Math.max(...coords.map((c) => c.sx)) - minX + 1) * SCREEN_W * PX;
const height = (Math.max(...coords.map((c) => c.sy)) - minY + 1) * SCREEN_H * PX;
const rgb = Buffer.alloc(width * height * 3, 16);

const paint = (x: number, y: number, [r, g, b]: [number, number, number]) => {
  const i = (y * width + x) * 3;
  rgb[i] = r;
  rgb[i + 1] = g;
  rgb[i + 2] = b;
};

for (const screen of world.values()) {
  const ox = (screen.coord.sx - minX) * SCREEN_W * PX;
  const oy = (screen.coord.sy - minY) * SCREEN_H * PX;
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      for (let py = 0; py < PX; py++) {
        for (let px = 0; px < PX; px++) {
          const corner = cornerAt(screen, tx + (px < PX / 2 ? 0 : 1), ty + (py < PX / 2 ? 0 : 1));
          paint(ox + tx * PX + px, oy + ty * PX + py, TERRAIN_RGB[corner]);
        }
      }
      const mark = FEATURE_RGB[featureAt(screen, tx, ty)];
      if (!mark) continue;
      for (let py = 2; py < PX - 2; py++) {
        for (let px = 2; px < PX - 2; px++) paint(ox + tx * PX + px, oy + ty * PX + py, mark);
      }
    }
  }
}

const chunk = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header.set([8, 2, 0, 0, 0], 8);
const rows = Buffer.concat(
  Array.from({ length: height }, (_, y) =>
    Buffer.concat([Buffer.from([0]), rgb.subarray(y * width * 3, (y + 1) * width * 3)]),
  ),
);
writeFileSync(
  out,
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]),
);
console.log(`${world.size} screens -> ${out} (${width}x${height})`);
