import type { RampName } from '../palette.ts';
import type { Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { TILE } from '../world.ts';
import { Canvas, clamp, ramp, spread } from './draw.ts';

export type RosetteParams = {
  /** Thick pointed leaves fanning out from a low base, as on an agave or aloe. */
  readonly leaves: RampName;
};

type Leaf = { angle: number; length: number; width: number; front: boolean };

export function rosette(p: RosetteParams, rng: Rng): Sprite {
  const c = new Canvas(TILE, TILE);
  const [dark, shaded, lit, light] = spread(ramp(p.leaves), 4);
  const foot = TILE - 2;
  const bx = TILE / 2 + (rng() - 0.5) * 0.6;
  const by = foot + 0.5;
  const count = 5 + Math.floor(rng() * 2);
  const leaves: Leaf[] = Array.from({ length: count }, (_, i) => {
    const t = (i + 0.3 + rng() * 0.4) / count;
    const angle = -Math.PI * (0.03 + 0.94 * t);
    const upright = Math.sin(-angle);
    return {
      angle,
      length: 6.5 + upright * 3 + rng() * 2,
      width: 3.4 + rng() * 0.8,
      front: false,
    };
  });
  // Upright leaves stand at the back, splayed ones overlap them, and a short one or two point out.
  leaves.sort((a, b) => Math.sin(b.angle) - Math.sin(a.angle));
  for (let i = 0; i < 1 + Math.floor(rng() * 2); i++) {
    leaves.push({
      angle: -Math.PI * (0.25 + 0.5 * rng()),
      length: 3.5 + rng() * 1.5,
      width: 3.4,
      front: true,
    });
  }
  for (const leaf of leaves) {
    const ux = Math.cos(leaf.angle);
    const uy = Math.sin(leaf.angle);
    const lean = ux < -0.3 ? 1 : ux > 0.3 ? -1 : 0;
    for (let y = 1; y <= foot; y++) {
      for (let x = 1; x < TILE - 1; x++) {
        const px = x + 0.5 - bx;
        const py = y + 0.5 - by;
        const along = px * ux + py * uy;
        const across = px * -uy + py * ux;
        if (along < -0.5 || along > leaf.length) continue;
        const half = (leaf.width / 2) * (1 - along / leaf.length) + 0.35;
        if (Math.abs(across) > half) continue;
        const litSide = across * (ux >= 0 ? 1 : -1) < 0;
        const rim = Math.abs(across) > half - 0.8;
        let colour = litSide ? lit : shaded;
        if (along > leaf.length - 1) colour = dark;
        else if (litSide && rim && lean >= 0) colour = light;
        else if (!litSide && rim && !leaf.front) colour = dark;
        c.set(x, y, colour!);
      }
    }
  }
  for (let x = Math.round(bx) - 2; x <= Math.round(bx) + 1; x++) {
    c.set(x, foot, x < bx ? shaded! : dark!);
  }
  c.outline();
  c.shadow(TILE / 2 + 0.5, TILE - 0.8, clamp(count, 5, 6), 1.2);
  return c.toSprite();
}
