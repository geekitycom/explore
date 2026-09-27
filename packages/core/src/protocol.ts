import { z } from 'zod';
import type { Avatar } from './avatar.ts';
import type { BiomeCell } from './biome.ts';
import type { ScreenRecord } from './codec.ts';
import type { Tile } from './place.ts';
import { tileX, tileY } from './traces/fields.ts';
import { SLOTS, type inventorySchema } from './traces/inventory.ts';
import { TRACE_KIND_NAMES, actionSchema, type traceSchema } from './traces/registry.ts';
import { DIRS, SCREEN_PX_H, SCREEN_PX_W, type Pose } from './world.ts';

/** Walking speed in screen pixels per second. */
export const WALK_SPEED = 72;
/** How often the client reports its position while moving. */
export const MOVE_INTERVAL_MS = 100;
/** WebSocket close code the server sends when a newer session replaces this one. */
export const REPLACED_CLOSE_CODE = 4000;
/** WebSocket close code the server sends when the player may not enter the world they asked for. */
export const REFUSED_CLOSE_CODE = 4403;
/** WebSocket close code the server sends after a visitor leaves for home through a portal. */
export const DEPARTED_CLOSE_CODE = 4001;
/** WebSocket close code the server sends when the socket's session has ended or never existed. */
export const SIGNED_OUT_CLOSE_CODE = 4401;

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
  z.object({ t: z.literal('interact'), tx: tileX, ty: tileY }),
  z.object({
    t: z.literal('use'),
    slot: z
      .number()
      .int()
      .min(0)
      .max(SLOTS - 1),
    tx: tileX,
    ty: tileY,
  }),
  z.object({ t: z.literal('act'), action: actionSchema }),
  z.object({ t: z.literal('report'), tx: tileX, ty: tileY, kind: z.enum(TRACE_KIND_NAMES) }),
  /** A visitor leaving for their own world; the server answers with `depart`. */
  z.object({ t: z.literal('goHome') }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

/** `name` is the player's display name, never their username. */
export type PlayerView = Pose & { id: number; name: string; avatar: Avatar };

export type TraceRecord = z.input<typeof traceSchema>;
export type TraceChangeRecord =
  { put: TraceRecord } | { drop: { tx: number; ty: number; kind: string } };
export type StackRecord = z.input<typeof inventorySchema>[number];

/**
 * How the player came to be on the screen. `wake` starts a new session in the garden (D24);
 * `visit` is a visitor's first step into someone else's world, out of a portal on `portal`, the
 * tile behind where they stand; `none` is a resume or a walk.
 */
export type Arrival = { kind: 'none' } | { kind: 'wake' } | { kind: 'visit'; portal: Tile };

export type ServerMessage =
  | {
      t: 'screen';
      screen: ScreenRecord;
      traces: TraceRecord[];
      patch: BiomeCell;
      you: Pose;
      others: PlayerView[];
      inventory: StackRecord[];
      arrival: Arrival;
    }
  | { t: 'traces'; changes: TraceChangeRecord[] }
  | { t: 'inventory'; stacks: StackRecord[] }
  | { t: 'refused'; reason: string }
  /**
   * The visitor leaves for home through a portal on `portal`; the socket closes next. `reason`
   * says why when the host closed their world rather than the visitor choosing to go.
   */
  | { t: 'depart'; portal: Tile; reason?: string }
  /** `portal` is where a visitor came through; absent for a walk, a resume, or a reconnect. */
  | { t: 'join'; player: PlayerView; portal?: Tile }
  /** `portal` is where a visitor went home through; absent for a walk or a dropped socket. */
  | { t: 'leave'; id: number; portal?: Tile }
  | ({ t: 'moved'; id: number } & Pose)
  | { t: 'profile'; id: number; name: string; avatar: Avatar }
  | { t: 'correct'; x: number; y: number };
