import type { DatabaseSync } from 'node:sqlite';
import {
  DIRS,
  decodeScreen,
  encodeScreen,
  generateScreen,
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
  sx: z.number().int(),
  sy: z.number().int(),
  x: z.number(),
  y: z.number(),
  dir: z.enum(DIRS),
});

function insertScreen(db: DatabaseSync, screen: Screen, userId: number | null): void {
  db.prepare(
    `INSERT INTO screens (sx, sy, data, created_by, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (sx, sy) DO NOTHING`,
  ).run(screen.coord.sx, screen.coord.sy, JSON.stringify(encodeScreen(screen)), userId, Date.now());
}

export function ensureGarden(db: DatabaseSync): void {
  insertScreen(db, secretGarden(), null);
}

export function getScreen(db: DatabaseSync, { sx, sy }: ScreenCoord): Screen | undefined {
  const row = db.prepare('SELECT data FROM screens WHERE sx = ? AND sy = ?').get(sx, sy) as
    { data: string } | undefined;
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
    .prepare('SELECT sx, sy, x, y, dir FROM player_state WHERE user_id = ?')
    .get(userId);
  if (row === undefined) return undefined;
  const { sx, sy, x, y, dir } = playerStateRow.parse(row);
  return { coord: { sx, sy }, pose: { x, y, dir, moving: false } };
}

export function savePlayerState(db: DatabaseSync, userId: number, state: PlayerState): void {
  db.prepare(
    `INSERT INTO player_state (user_id, sx, sy, x, y, dir, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       sx = excluded.sx, sy = excluded.sy, x = excluded.x, y = excluded.y,
       dir = excluded.dir, updated_at = excluded.updated_at`,
  ).run(
    userId,
    state.coord.sx,
    state.coord.sy,
    state.pose.x,
    state.pose.y,
    state.pose.dir,
    Date.now(),
  );
}
