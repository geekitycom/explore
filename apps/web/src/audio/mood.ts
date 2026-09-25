import { GARDEN_COORD, screenKey, type Screen } from '@explore/core';
import type { Mood } from './compose.ts';

/** Screens are grouped into blocks this many screens wide for choosing a tune. */
export const TUNE_REGION = 4;

export type Tune = { mood: Mood; seed: number; key: string };

const share = <T>(items: readonly T[], match: (item: T) => boolean) =>
  items.filter(match).length / items.length;

export function screenMood(screen: Screen): Mood {
  if (screenKey(screen.coord) === screenKey(GARDEN_COORD)) return 'garden';
  if (share(screen.corners, (t) => t === 'water') > 0.25) return 'lake';
  if (share(screen.features, (f) => f === 'tree' || f === 'bush') > 0.18) return 'forest';
  return 'meadow';
}

/**
 * Everyone in the same block of screens with the same mood hears the same tune, so walking
 * between neighbouring screens rarely changes the music.
 */
export function tuneFor(screen: Screen): Tune {
  const mood = screenMood(screen);
  const rx = Math.floor(screen.coord.sx / TUNE_REGION);
  const ry = Math.floor(screen.coord.sy / TUNE_REGION);
  const seed = mood === 'garden' ? 1 : (Math.imul(rx, 73856093) ^ Math.imul(ry, 19349663)) >>> 0;
  return { mood, seed, key: `${mood}:${seed}` };
}
