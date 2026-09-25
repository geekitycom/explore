import type { DatabaseSync } from 'node:sqlite';
import {
  CHUNK_H,
  CHUNK_W,
  GENERATOR_VERSION,
  SCREEN_RECORD_VERSION,
  DIRS,
  decodeScreen,
  encodeScreen,
  layerIdSchema,
  randomWorldSeed,
  secretGarden,
  type ChunkCoord,
  type Pose,
  type Screen,
  type ScreenCoord,
  worldSeedSchema,
  type World,
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

/** A stored screen is never replaced: the first generator to store a coordinate wins. */
function insertScreen(db: DatabaseSync, screen: Screen, userId: number | null): void {
  db.prepare(
    `INSERT INTO screens (layer, sx, sy, data, created_by, created_at, gen_version)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (layer, sx, sy) DO NOTHING`,
  ).run(
    screen.coord.layer,
    screen.coord.sx,
    screen.coord.sy,
    JSON.stringify(encodeScreen(screen)),
    userId,
    Date.now(),
    GENERATOR_VERSION,
  );
}

/** Whether every screen of the chunk is stored, whichever generator made each. */
export function isChunkStored(db: DatabaseSync, { layer, cx, cy }: ChunkCoord): boolean {
  const { n } = db
    .prepare(
      `SELECT count(*) AS n FROM screens
       WHERE layer = ? AND sx >= ? AND sx < ? AND sy >= ? AND sy < ?`,
    )
    .get(layer, cx * CHUNK_W, (cx + 1) * CHUNK_W, cy * CHUNK_H, (cy + 1) * CHUNK_H) as {
    n: number;
  };
  return n === CHUNK_W * CHUNK_H;
}

/** Stores a whole chunk at once, keeping any screen of it stored earlier. */
export function storeChunk(db: DatabaseSync, screens: readonly Screen[], userId: number): void {
  db.exec('BEGIN');
  try {
    for (const screen of screens) insertScreen(db, screen, userId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * How many stored screens an older generator made. They cannot be read or mixed with new
 * screens, and only an admin decides to throw a world away, so the server refuses to start.
 */
export function outdatedScreens(db: DatabaseSync): number {
  const row = db
    .prepare("SELECT count(*) AS n FROM screens WHERE json_extract(data, '$.v') IS NOT ?")
    .get(SCREEN_RECORD_VERSION) as { n: number };
  return row.n;
}

export function ensureGarden(db: DatabaseSync): void {
  insertScreen(db, secretGarden(), null);
}

const worldRow = z.object({ seed: worldSeedSchema });

/** Its row is created by the migrations. */
export function loadWorld(db: DatabaseSync): World {
  const row: unknown = db.prepare('SELECT seed FROM world WHERE id = 1').get();
  return { seed: worldRow.parse(row).seed };
}

export function reseedWorld(db: DatabaseSync): void {
  db.prepare('UPDATE world SET seed = ? WHERE id = 1').run(randomWorldSeed());
}

export function getScreen(db: DatabaseSync, { layer, sx, sy }: ScreenCoord): Screen | undefined {
  const row = db
    .prepare('SELECT data FROM screens WHERE layer = ? AND sx = ? AND sy = ?')
    .get(layer, sx, sy) as { data: string } | undefined;
  return row && decodeScreen(JSON.parse(row.data));
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
