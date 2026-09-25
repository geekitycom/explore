import type { DatabaseSync } from 'node:sqlite';
import {
  DIRS,
  decodeScreen,
  encodeScreen,
  generateScreen,
  layerIdSchema,
  neighborsOf,
  randomSeed,
  secretGarden,
  type Pose,
  type Screen,
  type ScreenCoord,
} from '@explore/core';
import { z } from 'zod';

export type PlayerState = { coord: ScreenCoord; pose: Pose };

const playerStateRow = z.object({
  layer: layerIdSchema,
  sx: z.number().int(),
  sy: z.number().int(),
  x: z.number(),
  y: z.number(),
  dir: z.enum(DIRS),
});

function insertScreen(db: DatabaseSync, screen: Screen, userId: number | null): void {
  db.prepare(
    `INSERT INTO screens (layer, sx, sy, data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (layer, sx, sy) DO NOTHING`,
  ).run(
    screen.coord.layer,
    screen.coord.sx,
    screen.coord.sy,
    JSON.stringify(encodeScreen(screen)),
    userId,
    Date.now(),
  );
}

export function ensureGarden(db: DatabaseSync): void {
  insertScreen(db, secretGarden(), null);
}

export function getScreen(db: DatabaseSync, { layer, sx, sy }: ScreenCoord): Screen | undefined {
  const row = db
    .prepare('SELECT data FROM screens WHERE layer = ? AND sx = ? AND sy = ?')
    .get(layer, sx, sy) as { data: string } | undefined;
  return row && decodeScreen(JSON.parse(row.data));
}

/** Synchronous from select to insert, so two arrivals at a new coordinate get one screen. */
export function getOrCreateScreen(db: DatabaseSync, coord: ScreenCoord, userId: number): Screen {
  const existing = getScreen(db, coord);
  if (existing) return existing;
  const lookup = (c: ScreenCoord) => getScreen(db, c);
  insertScreen(db, generateScreen(coord, randomSeed(), neighborsOf(coord, lookup)), userId);
  return getScreen(db, coord)!;
}

export function loadPlayerState(db: DatabaseSync, userId: number): PlayerState | undefined {
  const row: unknown = db
    .prepare('SELECT layer, sx, sy, x, y, dir FROM player_state WHERE user_id = ?')
    .get(userId);
  if (row === undefined) return undefined;
  const { layer, sx, sy, x, y, dir } = playerStateRow.parse(row);
  return { coord: { layer, sx, sy }, pose: { x, y, dir, moving: false } };
}

export function savePlayerState(db: DatabaseSync, userId: number, state: PlayerState): void {
  db.prepare(
    `INSERT INTO player_state (user_id, layer, sx, sy, x, y, dir, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       layer = excluded.layer, sx = excluded.sx, sy = excluded.sy, x = excluded.x, y = excluded.y,
       dir = excluded.dir, updated_at = excluded.updated_at`,
  ).run(
    userId,
    state.coord.layer,
    state.coord.sx,
    state.coord.sy,
    state.pose.x,
    state.pose.y,
    state.pose.dir,
    Date.now(),
  );
}
