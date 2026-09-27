import type { WorldDb } from './db.ts';
import {
  EPITAPH_MAX,
  LANDMARK_NOUNS,
  graveName,
  landmarkAround,
  layerIdSchema,
  seedEpitaph,
  traceSchema,
  type Biome,
  type ScreenCoord,
  type Tile,
  type TraceNamed,
} from '@explore/core';
import { LANDS, cleanLine, linesOf } from './game-text.ts';
import type { TextRequest } from './text-gen.ts';
import { loadWorld } from './world.ts';
import type { Scribe } from './writer.ts';

type Epitaph = TraceNamed<'epitaph'>;

export function epitaphPrompt(name: string, biome: Biome, ground: string | undefined): TextRequest {
  const where = `${ground ? `a ${ground} in ` : ''}${LANDS[biome]}`;
  return {
    messages: [
      {
        role: 'system',
        content:
          'You write the words carved on graves in a gentle, cozy exploration game. ' +
          'Reply with the epitaph only: one short line of at most eight words that names ' +
          'the person and says something about who they were or what they loved, not only ' +
          'the landscape. Never guess whether they were a man or a woman. ' +
          'No quotation marks, nothing crude or cruel. Wry, tender and plain are all welcome.',
      },
      { role: 'user', content: `Write the epitaph for ${name}, buried in ${where}.` },
    ],
    maxTokens: 40,
    temperature: 0.9,
  };
}

/**
 * The first line of a model's reply as carved words, or undefined when it is empty, too long, or
 * says something a grave should not.
 */
export const cleanEpitaph = (raw: string): string | undefined =>
  cleanLine(linesOf(raw)[0] ?? '', EPITAPH_MAX, /^epitaph\s*:\s*/i);

/** Writes each grave's epitaph once, while it still shows the seed epitaph. */
export const epitaphScribe: Scribe<TraceNamed<'epitaph'>> = {
  kind: 'epitaph',
  waiting: (grave) => grave.source === 'pending',
  request: (grave, world, { coord, biome }) => {
    const ground = landmarkAround(world, coord, grave);
    return epitaphPrompt(graveName(world, coord, grave), biome, ground && LANDMARK_NOUNS[ground]);
  },
  written: (grave, reply) => {
    const text = cleanEpitaph(reply);
    return text === undefined ? undefined : { ...grave, text, source: 'model' };
  },
};

type Row = { layer: string; sx: number; sy: number; tx: number; ty: number; data: string };

export type StoredEpitaph = { coord: ScreenCoord; tile: Tile; text: string; source: string };

const epitaphOf = (row: Row) => {
  const parsed = traceSchema.safeParse(JSON.parse(row.data));
  return parsed.success && parsed.data.kind === 'epitaph' ? parsed.data : undefined;
};

export function listEpitaphs(db: WorldDb): StoredEpitaph[] {
  const rows = db
    .prepare(
      `SELECT layer, sx, sy, tx, ty, data FROM traces WHERE kind = 'epitaph'
       ORDER BY layer, sy, sx, ty, tx`,
    )
    .all() as Row[];
  return rows.flatMap((row) => {
    const trace = epitaphOf(row);
    if (!trace) return [];
    const { layer, sx, sy, tx, ty } = row;
    return [
      {
        coord: { layer: layerIdSchema.parse(layer), sx, sy },
        tile: { tx, ty },
        text: trace.text,
        source: trace.source,
      },
    ];
  });
}

/**
 * Replaces a grave's epitaph with an admin's words, or with no text restores its seed epitaph for
 * good. Returns the words it replaced, or undefined when that grave has no epitaph yet. A server
 * holding the screen open shows the change once everyone has left it.
 */
export function setEpitaph(
  db: WorldDb,
  coord: ScreenCoord,
  tile: Tile,
  text: string | undefined,
): string | undefined {
  const { layer, sx, sy } = coord;
  const { tx, ty } = tile;
  const row = db
    .prepare(
      `SELECT layer, sx, sy, tx, ty, data FROM traces
       WHERE layer = ? AND sx = ? AND sy = ? AND tx = ? AND ty = ? AND kind = 'epitaph'`,
    )
    .get(layer, sx, sy, tx, ty) as Row | undefined;
  const trace = row && epitaphOf(row);
  if (!trace) return undefined;
  const next: Epitaph =
    text === undefined
      ? { ...trace, text: seedEpitaph(loadWorld(db), coord, tile), source: 'seed' }
      : { ...trace, text, source: 'admin' };
  db.prepare(
    `UPDATE traces SET data = ?, updated_by = NULL, updated_at = ?
     WHERE layer = ? AND sx = ? AND sy = ? AND tx = ? AND ty = ? AND kind = 'epitaph'`,
  ).run(JSON.stringify(next), Date.now(), layer, sx, sy, tx, ty);
  return trace.text;
}
