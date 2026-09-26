import type { PlayerView, Tile } from '@explore/core';

/**
 * A visitor coming into the world or going home. A portal opens on `tile` and the traveller
 * steps out of it (`arrive`) or into it (`depart`). `start` is on the render clock
 * (`performance.now()`), and everything about how the portal looks follows from the time since.
 * The traveller is `you`, or a snapshot of another player taken when the portal began.
 */
export type Portal = {
  readonly kind: 'arrive' | 'depart';
  readonly tile: Tile;
  readonly start: number;
  readonly traveller: 'you' | PlayerView;
};

/**
 * The portal's stages in order, with how long each lasts in ms: a glowing dot appears, opens
 * into the portal, holds while the traveller comes or goes, and closes. About two seconds.
 */
export const PORTAL_STAGES = [
  ['spark', 300],
  ['opening', 500],
  ['open', 500],
  ['closing', 600],
] as const;

export type PortalStage = (typeof PORTAL_STAGES)[number][0];

export const PORTAL_MS = PORTAL_STAGES.reduce((sum, [, ms]) => sum + ms, 0);

/** How big the glowing dot is next to the open portal. */
const SPARK_SIZE = 0.15;

/**
 * When the traveller comes out of or goes into the portal, in ms from its start: after it has
 * opened, before it closes. An arriving visitor has appeared, and may move, at `to`.
 */
const TRAVEL: Record<Portal['kind'], { from: number; to: number }> = {
  arrive: { from: 800, to: 1200 },
  depart: { from: 800, to: 1300 },
};

/** How far `t` has got from `from` to `to`, clamped to 0..1. */
const ramp = (t: number, from: number, to: number) =>
  Math.min(1, Math.max(0, (t - from) / (to - from)));

const SIZES: Record<PortalStage, (through: number) => number> = {
  spark: (t) => SPARK_SIZE * t,
  opening: (t) => SPARK_SIZE + (1 - SPARK_SIZE) * t,
  open: () => 1,
  closing: (t) => 1 - t,
};

/** The portal at `now`: its stage, how far through that stage (0..1), and its size (0..1). */
export function portalLook(
  portal: Portal,
  now: number,
): { stage: PortalStage; through: number; size: number } | undefined {
  let begins = portal.start;
  for (const [stage, ms] of PORTAL_STAGES) {
    if (now < begins + ms) {
      const through = ramp(now, begins, begins + ms);
      return { stage, through, size: SIZES[stage](through) };
    }
    begins += ms;
  }
  return undefined;
}

/**
 * How the traveller shows at `now` while the portal carries them: `shown` from 0 (not there) to
 * 1 (fully there), and `along` from 0 (on their own tile) to 1 (at the portal). Undefined once
 * an arrival has appeared and is drawn like anyone else; a departure stays gone.
 */
export function travellerLook(
  portal: Portal,
  now: number,
): { shown: number; along: number } | undefined {
  const { from, to } = TRAVEL[portal.kind];
  const t = now - portal.start;
  const moved = ramp(t, from, to);
  if (portal.kind === 'depart') return { shown: 1 - ramp(t, (from + to) / 2, to), along: moved };
  return t < to ? { shown: moved, along: 1 - moved } : undefined;
}

/** Whether the portal has closed by `now`. */
export const portalDone = (portal: Portal, now: number) => now - portal.start >= PORTAL_MS;

/** You cannot move while a portal carries you: until you have appeared, or at all when leaving. */
export const youCanMove = (portals: readonly Portal[], now: number) =>
  !portals.some((p) => p.traveller === 'you' && travellerLook(p, now) !== undefined);
