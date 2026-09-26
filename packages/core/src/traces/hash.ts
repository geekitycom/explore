import type { ScreenCoord } from '../world.ts';

export function tileHash({ sx, sy }: ScreenCoord, tx: number, ty: number, salt: number): number {
  let h = Math.imul(sx, 0x27d4eb2d) ^ Math.imul(sy, 0x165667b1) ^ Math.imul(salt + 1, 0x9e3779b1);
  h = Math.imul(h ^ Math.imul(tx + 1, 0x85ebca6b), 0xc2b2ae35);
  h = Math.imul(h ^ Math.imul(ty + 1, 0x27d4eb2f), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  return (h ^ (h >>> 13)) >>> 0;
}
