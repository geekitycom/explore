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
  upgradeScreenRecord,
  type ChunkCoord,
  type Pose,
  type Screen,
  type ScreenCoord,
  worldSeedSchema,
  type World,
} from '@explore/core';
import { z } from 'zod';

type PlayerState = { coord: ScreenCoord; pose: Pose };

/** `seenAt` is when the player was last known to be connected; their session ends a timeout later. */
type SavedPlayer = PlayerState & { seenAt: number };

const playerStateRow = z.object({
  layer: layerIdSchema,
  sx: z.number().int(),
  sy: z.number().int(),
  x: z.number(),
  y: z.number(),
  dir: z.enum(DIRS),
  updated_at: z.number().int(),
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
 * Rewrites every stored screen recorded in an earlier format as the current one, keeping its
 * cells, in one transaction. Runs at every open and changes nothing once records are current.
 * Never deletes a screen: a record it cannot lift stops the open (decision D22).
 */
export function upgradeScreenRecords(db: DatabaseSync): number {
  const rows = db
    .prepare("SELECT layer, sx, sy, data FROM screens WHERE json_extract(data, '$.v') IS NOT ?")
    .all(SCREEN_RECORD_VERSION) as { layer: string; sx: number; sy: number; data: string }[];
  if (rows.length === 0) return 0;
  const world = loadWorld(db);
  const update = db.prepare('UPDATE screens SET data = ? WHERE layer = ? AND sx = ? AND sy = ?');
  db.exec('BEGIN');
  try {
    for (const { layer, sx, sy, data } of rows) {
      const record = upgradeScreenRecord(JSON.parse(data), world);
      update.run(JSON.stringify(record), layer, sx, sy);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return rows.length;
}

/** A stored screen an older generator made, which new neighbours stitch to. */
export function olderScreen(db: DatabaseSync, { layer, sx, sy }: ScreenCoord): Screen | undefined {
  const row = db
    .prepare('SELECT data FROM screens WHERE layer = ? AND sx = ? AND sy = ? AND gen_version < ?')
    .get(layer, sx, sy, GENERATOR_VERSION) as { data: string } | undefined;
  return row && decodeScreen(JSON.parse(row.data));
}

/**
 * Stores the hand-built garden, replacing a stored garden from an earlier layout in place. Its
 * neighbours keep their edges; a seam crossing only needs both facing tiles walkable.
 */
export function ensureGarden(db: DatabaseSync): void {
  const garden = secretGarden();
  db.prepare(
    `INSERT INTO screens (layer, sx, sy, data, created_by, created_at, gen_version)
     VALUES (?, ?, ?, ?, NULL, ?, ?)
     ON CONFLICT (layer, sx, sy) DO UPDATE SET data = excluded.data, gen_version = excluded.gen_version`,
  ).run(
    garden.coord.layer,
    garden.coord.sx,
    garden.coord.sy,
    JSON.stringify(encodeScreen(garden)),
    Date.now(),
    GENERATOR_VERSION,
  );
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

/** The map shows a screen once any player has stood on it. */
export function recordVisit(db: DatabaseSync, { layer, sx, sy }: ScreenCoord): void {
  db.prepare('INSERT INTO visits (layer, sx, sy) VALUES (?, ?, ?) ON CONFLICT DO NOTHING').run(
    layer,
    sx,
    sy,
  );
}

export function loadPlayerState(db: DatabaseSync, userId: number): SavedPlayer | undefined {
  const row: unknown = db
    .prepare('SELECT layer, sx, sy, x, y, dir, updated_at FROM player_state WHERE user_id = ?')
    .get(userId);
  if (row === undefined) return undefined;
  const { layer, sx, sy, x, y, dir, updated_at } = playerStateRow.parse(row);
  return { coord: { layer, sx, sy }, pose: { x, y, dir, moving: false }, seenAt: updated_at };
}

export function savePlayerState(
  db: DatabaseSync,
  userId: number,
  state: PlayerState,
  seenAt = Date.now(),
): void {
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
    seenAt,
  );
}
