import type { WorldDb } from './db.ts';
import {
  layerIdSchema,
  seedSign,
  traceSchema,
  type ScreenCoord,
  type Sign,
  type TraceNamed,
} from '@explore/core';
import { loadWorld } from './world.ts';

export type LandmarkName = {
  coord: ScreenCoord;
  /** The land's words; undefined for a site no signpost has stood on yet. */
  sign: Sign | undefined;
  /** A player's name over them. */
  named: { name: string; line: string | undefined; by: string } | undefined;
  reports: number;
};

type Row = { layer: string; sx: number; sy: number; tx: number; ty: number; data: string };
type Site = TraceNamed<'landmark'>;

const siteIn = (row: Row): Site | undefined => {
  const parsed = traceSchema.safeParse(JSON.parse(row.data));
  return parsed.success && parsed.data.kind === 'landmark' ? parsed.data : undefined;
};

/** Every landmark with words on its signpost, with how many reports the signpost has drawn. */
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
    const site = siteIn(row);
    if (!site || (!site.sign && !site.named)) return [];
    const { layer, sx, sy, tx, ty } = row;
    const { n } = reports.get(layer, sx, sy, tx, ty) as { n: number };
    const { named } = site;
    return [
      {
        coord: { layer: layerIdSchema.parse(layer), sx, sy },
        sign: site.sign,
        named: named && { name: named.name, line: named.line, by: named.by.name },
        reports: n,
      },
    ];
  });
}

/**
 * Rewrites the landmark on a screen with `change`, which returns the new site, or undefined to
 * leave it. A server holding the screen open shows the change once everyone has left it.
 */
function changeSite(
  db: WorldDb,
  coord: ScreenCoord,
  change: (site: Site) => Site | undefined,
): Site | undefined {
  const { layer, sx, sy } = coord;
  const row = db
    .prepare(
      `SELECT layer, sx, sy, tx, ty, data FROM traces
       WHERE layer = ? AND sx = ? AND sy = ? AND kind = 'landmark'`,
    )
    .get(layer, sx, sy) as Row | undefined;
  const site = row && siteIn(row);
  const next = site && change(site);
  if (!next) return undefined;
  db.prepare(
    `UPDATE traces SET data = ?, updated_by = NULL, updated_at = ?
     WHERE layer = ? AND sx = ? AND sy = ? AND tx = ? AND ty = ? AND kind = 'landmark'`,
  ).run(JSON.stringify(next), Date.now(), layer, sx, sy, site.tx, site.ty);
  return site;
}

/**
 * Takes a player's name off the landmark on a screen, so the land's words show again. Returns
 * the name it took off, or undefined when no player had named it.
 */
export function restoreName(db: WorldDb, coord: ScreenCoord): string | undefined {
  return changeSite(db, coord, ({ named, ...site }) => (named ? site : undefined))?.named?.name;
}

/**
 * Puts the landmark's seed words back for good, in place of words the model wrote. A player's
 * name stays on top. Returns the name it replaced, or undefined when the screen has no signpost.
 */
export function reseedName(db: WorldDb, coord: ScreenCoord): string | undefined {
  const world = loadWorld(db);
  const site = changeSite(db, coord, (site) =>
    site.sign
      ? { ...site, sign: { ...seedSign(world, coord, site, site.poi), source: 'seed' } }
      : undefined,
  );
  return site?.sign?.name;
}
