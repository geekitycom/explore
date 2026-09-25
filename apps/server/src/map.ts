import type { DatabaseSync } from 'node:sqlite';
import { GARDEN_COORD, type ScreenCoord } from '@explore/core';
import { loadPlayerState } from './world.ts';

/**
 * Every screen on the viewer's layer that some player has stood on, as a JSON body. Stored
 * records are already JSON, so they are spliced in as-is rather than decoded and re-encoded; the
 * client validates each one.
 */
export function worldMapJson(db: DatabaseSync, userId: number): string {
  const you: ScreenCoord = loadPlayerState(db, userId)?.coord ?? GARDEN_COORD;
  const { layer } = you;
  const rows = db
    .prepare('SELECT data FROM screens JOIN visits USING (layer, sx, sy) WHERE layer = ?')
    .all(layer) as { data: string }[];
  const garden = layer === GARDEN_COORD.layer ? GARDEN_COORD : null;
  return `{"layer":${JSON.stringify(layer)},"you":${JSON.stringify(you)},"garden":${JSON.stringify(garden)},"screens":[${rows.map((r) => r.data).join(',')}]}`;
}
