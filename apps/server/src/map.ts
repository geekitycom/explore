import type { WorldDb } from './db.ts';
import { GARDEN_COORD, SCREEN_H, SCREEN_W, traceSchema, type LayerId } from '@explore/core';
import { loadPlayerState } from './world.ts';

/** A named landmark on the map, at its signpost, in world tiles. */
export type MapName = { x: number; y: number; name: string };

/**
 * Every screen on the viewer's layer that some player has stood on, as a JSON body, with the
 * names of the landmarks on them. Stored records are already JSON, so they are spliced in as-is
 * rather than decoded and re-encoded; the client validates each one.
 */
export function worldMapJson(db: WorldDb, userId: number): string {
  const you = loadPlayerState(db, userId)?.coord ?? GARDEN_COORD;
  const { layer } = you;
  const rows = db
    .prepare('SELECT data FROM screens JOIN visits USING (layer, sx, sy) WHERE layer = ?')
    .all(layer) as { data: string }[];
  const garden = layer === GARDEN_COORD.layer ? GARDEN_COORD : null;
  return `{"layer":${JSON.stringify(layer)},"you":${JSON.stringify(you)},"garden":${JSON.stringify(garden)},"names":${JSON.stringify(namesOn(db, layer))},"screens":[${rows.map((r) => r.data).join(',')}]}`;
}

function namesOn(db: WorldDb, layer: LayerId): MapName[] {
  const rows = db
    .prepare(
      `SELECT sx, sy, data FROM traces JOIN visits USING (layer, sx, sy)
       WHERE layer = ? AND kind = 'landmark'`,
    )
    .all(layer) as { sx: number; sy: number; data: string }[];
  return rows.flatMap(({ sx, sy, data }) => {
    const trace = traceSchema.safeParse(JSON.parse(data));
    if (!trace.success || trace.data.kind !== 'landmark' || !trace.data.named) return [];
    const { tx, ty, named } = trace.data;
    return [{ x: sx * SCREEN_W + tx + 0.5, y: sy * SCREEN_H + ty + 0.5, name: named.name }];
  });
}
