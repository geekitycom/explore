import { z } from 'zod';
import { avatarSchema, type Avatar } from './avatar.ts';
import type { ScreenRecord } from './codec.ts';
import { DIRS, SCREEN_PX_H, SCREEN_PX_W, type Dir } from './world.ts';

/** Walking speed in screen pixels per second. */
export const WALK_SPEED = 72;
/** How often the client reports its position while moving. */
export const MOVE_INTERVAL_MS = 100;

const dirSchema = z.enum(DIRS);
const coordinate = (max: number) =>
  z
    .number()
    .finite()
    .min(-32)
    .max(max + 32);

export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('move'),
    x: coordinate(SCREEN_PX_W),
    y: coordinate(SCREEN_PX_H),
    dir: dirSchema,
    moving: z.boolean(),
  }),
  z.object({ t: z.literal('travel'), dir: dirSchema }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export type Pose = { x: number; y: number; dir: Dir; moving: boolean };

export type PlayerView = Pose & { id: number; name: string; avatar: Avatar };

export const playerViewSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  avatar: avatarSchema,
  x: z.number(),
  y: z.number(),
  dir: dirSchema,
  moving: z.boolean(),
});

export type ServerMessage =
  | { t: 'screen'; screen: ScreenRecord; you: Pose; others: PlayerView[] }
  | { t: 'join'; player: PlayerView }
  | { t: 'leave'; id: number }
  | ({ t: 'moved'; id: number } & Pose)
  | { t: 'correct'; x: number; y: number };
