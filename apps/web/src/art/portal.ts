import { OUTLINE, RAMPS, TILE, type Tile } from '@explore/core';

/** Half the open portal's width and height in pixels: an upright oval a little taller than a player. */
const RX = 7;
const RY = 10;
/** The oval's lowest pixel sits this far above the bottom of its tile, where feet stand. */
const LIFT = 1;
/** Dark to light, the swirl's colours: the water ramp's blues opening onto a white core. */
const SWIRL = [...RAMPS.water.slice(0, 5), RAMPS.snow[3], RAMPS.snow[4]] as const;
const GLOW = RAMPS.water[5];
/** Just inside the outline, the rim burns brightest. */
const RIM = RAMPS.water[4];
const CORE = RAMPS.snow[4];
/** Spiral arms, how far each winds from rim to centre, and turns per second. */
const ARMS = 3;
const TWIST = 1.3;
const SPIN = 0.9;
/** Below this size the portal is still the glowing dot it opens from. */
const DOT_SIZE = 0.15;

/** The screen pixel at the portal's centre on `tile`: where it opens from and closes to. */
export function portalCentre({ tx, ty }: Tile): { x: number; y: number } {
  return { x: tx * TILE + TILE / 2, y: (ty + 1) * TILE - LIFT - RY };
}

/** Where a traveller stands in the mouth of the portal on `tile`. */
export function portalFeet({ tx, ty }: Tile): { x: number; y: number } {
  return { x: tx * TILE + TILE / 2, y: (ty + 1) * TILE - LIFT - 2 };
}

const px = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
};

/** The glowing dot a portal opens from: a white core in a cyan cross with a faint halo. */
function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, grow: number, clock: number) {
  const pulse = 0.5 + 0.5 * Math.sin(clock * 18);
  const reach = grow < 0.4 ? 1 : 2;
  ctx.save();
  ctx.globalAlpha *= 0.3 + 0.25 * pulse;
  for (let dy = -reach - 1; dy <= reach + 1; dy++)
    for (let dx = -reach - 1; dx <= reach + 1; dx++)
      if (Math.abs(dx) + Math.abs(dy) <= reach + 1) px(ctx, x + dx, y + dy, GLOW);
  ctx.restore();
  for (let d = -reach; d <= reach; d++) {
    px(ctx, x + d, y, GLOW);
    px(ctx, x, y + d, GLOW);
  }
  px(ctx, x, y, CORE);
  if (reach > 1) {
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const)
      px(ctx, x + dx, y + dy, CORE);
    for (const [dx, dy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const)
      px(ctx, x + dx, y + dy, GLOW);
  }
}

/** Inside the oval of half-sizes (rx, ry) at pixel offset (dx, dy) from its centre. */
const inside = (dx: number, dy: number, rx: number, ry: number) =>
  ((dx + 0.5) / rx) ** 2 + ((dy + 0.5) / ry) ** 2 <= 1;

/**
 * Draws the portal on `tile` at `size` (0 closed, 1 open), on the garden's pixel grid. Small, it is
 * a glowing dot; open, an outlined oval whose spiral arms turn with `clock` (seconds). With `spin`
 * off the arms hold still, for reduced motion.
 */
export function drawPortal(
  ctx: CanvasRenderingContext2D,
  tile: Tile,
  size: number,
  clock: number,
  spin: boolean,
): void {
  const centre = portalCentre(tile);
  if (size < DOT_SIZE) {
    drawDot(ctx, centre.x, centre.y, size / DOT_SIZE, clock);
    return;
  }
  const rx = Math.max(2, Math.round(RX * size));
  const ry = Math.max(2, Math.round(RY * size));
  const turn = spin ? clock * SPIN : 0;

  const glow = spin ? 0.5 + 0.15 * Math.sin(clock * 6) : 0.5;
  for (const [reach, strength] of [
    [1, glow],
    [2.2, glow * 0.45],
  ] as const) {
    ctx.save();
    ctx.globalAlpha *= strength;
    for (let dy = -ry - 3; dy <= ry + 2; dy++) {
      for (let dx = -rx - 3; dx <= rx + 2; dx++) {
        const outer = inside(dx, dy, rx + reach, ry + reach);
        const inner = inside(dx, dy, rx + reach - 1.2, ry + reach - 1.2);
        if (outer && !inner && !inside(dx, dy, rx, ry)) px(ctx, centre.x + dx, centre.y + dy, GLOW);
      }
    }
    ctx.restore();
  }

  for (let dy = -ry; dy < ry; dy++) {
    for (let dx = -rx; dx < rx; dx++) {
      if (!inside(dx, dy, rx, ry)) continue;
      const rim =
        !inside(dx - 1, dy, rx, ry) ||
        !inside(dx + 1, dy, rx, ry) ||
        !inside(dx, dy - 1, rx, ry) ||
        !inside(dx, dy + 1, rx, ry);
      if (rim) {
        px(ctx, centre.x + dx, centre.y + dy, OUTLINE);
        continue;
      }
      const nearRim =
        !inside(dx - 2, dy, rx, ry) ||
        !inside(dx + 2, dy, rx, ry) ||
        !inside(dx, dy - 2, rx, ry) ||
        !inside(dx, dy + 2, rx, ry);
      if (nearRim) {
        px(ctx, centre.x + dx, centre.y + dy, RIM);
        continue;
      }
      const u = (dx + 0.5) / rx;
      const v = (dy + 0.5) / ry;
      const r = Math.hypot(u, v);
      const angle = Math.atan2(v, u) / (2 * Math.PI);
      const arm = (((angle * ARMS + r * TWIST - turn) % 1) + 1) % 1;
      const level = 0.6 + (1 - r) * 3.6 + (arm < 0.38 ? 2.4 : 0);
      const color = SWIRL[Math.max(0, Math.min(SWIRL.length - 1, Math.floor(level)))]!;
      px(ctx, centre.x + dx, centre.y + dy, color);
    }
  }
}
