import type { WorldDb } from './db.ts';
import { layerIdSchema, traceSchema, type ScreenCoord } from '@explore/core';

export type LandmarkName = {
  coord: ScreenCoord;
  name: string;
  line: string | undefined;
  by: string;
  reports: number;
};

type Row = { layer: string; sx: number; sy: number; tx: number; ty: number; data: string };

const named = (row: Row) => {
  const parsed = traceSchema.safeParse(JSON.parse(row.data));
  return parsed.success && parsed.data.kind === 'landmark' && parsed.data.named
    ? parsed.data
    : undefined;
};

/** Every named landmark, with how many reports its signpost has drawn. */
export function landmarkNames(db: WorldDb): LandmarkName[] {
  const rows = db
    .prepare(
      `SELECT layer, sx, sy, tx, ty, data FROM traces WHERE kind = 'landmark' ORDER BY layer, sy, sx`,
    )
    .all() as Row[];
  const reports = db.prepare(
    `SELECT count(*) AS n FROM trace_reports
     WHERE layer = ? AND sx = ? AND sy = ? AND tx = ? AND ty = ? AND kind = 'landmark'`,
  );
  return rows.flatMap((row) => {
    const trace = named(row);
    if (!trace?.named) return [];
    const { layer, sx, sy, tx, ty } = row;
    const { n } = reports.get(layer, sx, sy, tx, ty) as { n: number };
    return [
      {
        coord: { layer: layerIdSchema.parse(layer), sx, sy },
        name: trace.named.name,
        line: trace.named.line,
        by: trace.named.by.name,
        reports: n,
      },
    ];
  });
}

/**
 * Takes the name off the landmark on a screen, leaving it free for the next visitor to name.
 * Returns the name it cleared. A server holding the screen open shows the change once everyone
 * has left it.
 */
export function clearName(db: WorldDb, { layer, sx, sy }: ScreenCoord): string | undefined {
  const row = db
    .prepare(
      `SELECT layer, sx, sy, tx, ty, data FROM traces
       WHERE layer = ? AND sx = ? AND sy = ? AND kind = 'landmark'`,
    )
    .get(layer, sx, sy) as Row | undefined;
  const trace = row && named(row);
  if (!row || !trace?.named) return undefined;
  const { named: cleared, ...site } = trace;
  db.prepare(
    `UPDATE traces SET data = ?, updated_by = NULL, updated_at = ?
     WHERE layer = ? AND sx = ? AND sy = ? AND tx = ? AND ty = ? AND kind = 'landmark'`,
  ).run(JSON.stringify(site), Date.now(), layer, sx, sy, row.tx, row.ty);
  return cleared.name;
}
