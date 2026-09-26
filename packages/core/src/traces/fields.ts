import { z } from 'zod';
import { RAMPS, type RampName } from '../palette.ts';
import { SCREEN_H, SCREEN_W } from '../world.ts';

export const tileX = z
  .number()
  .int()
  .min(0)
  .max(SCREEN_W - 1);
export const tileY = z
  .number()
  .int()
  .min(0)
  .max(SCREEN_H - 1);
export const rampName = z.enum(Object.keys(RAMPS) as [RampName, ...RampName[]]);
export const userRef = z.object({ id: z.number().int(), name: z.string() });
/** Milliseconds since the epoch. */
export const epochMs = z.number().int().min(0);
export const DAY_MS = 86_400_000;
