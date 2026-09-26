import { z } from 'zod';

export const DISPLAY_NAME_MAX = 20;

/** What other players see: any text, not unique, trimmed before it is checked or stored. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a display name')
  .max(DISPLAY_NAME_MAX, `Display name must be at most ${DISPLAY_NAME_MAX} characters`)
  .regex(/^\P{Cc}*$/u, 'Display name cannot contain control characters');
