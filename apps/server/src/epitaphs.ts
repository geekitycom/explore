import type { DatabaseSync } from 'node:sqlite';
import {
  EPITAPH_MAX,
  LANDMARK_NOUNS,
  graveName,
  landmarkAround,
  layerIdSchema,
  screenKey,
  seedEpitaph,
  traceSchema,
  type Biome,
  type Place,
  type ScreenCoord,
  type Tile,
  type TraceNamed,
  type World,
} from '@explore/core';
import type { TextRequest, TextResult } from './text-gen.ts';
import type { TraceStore } from './traces.ts';
import { loadWorld } from './world.ts';

export type WriteText = (request: TextRequest) => Promise<TextResult>;
type Epitaph = TraceNamed<'epitaph'>;

const LANDS: Readonly<Record<Biome, string>> = {
  garden: 'a walled garden',
  meadow: 'the meadows',
  forest: 'a deep forest',
  lakeland: 'the lake country',
  scrubland: 'dry scrubland',
  desert: 'the desert',
  highlands: 'the windy highlands',
  taiga: 'the northern pine woods',
  tundra: 'the frozen tundra',
};

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

const BLOCKED =
  /\b(fuck\w*|shit\w*|cunt\w*|bitch\w*|bastard\w*|whore\w*|slut\w*|nigg\w*|fag\w*|retard\w*|rape\w*|nazi\w*|kill yourself|as an ai|language model|i cannot|i can't)\b/i;

/**
 * The first line of a model's reply as carved words, or undefined when it is empty, too long, or
 * says something a grave should not.
 */
export function cleanEpitaph(raw: string): string | undefined {
  const line = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  const text = (line ?? '')
    .replace(/^epitaph\s*:\s*/i, '')
    .replace(/["“”«»*_`]/g, '')
    .replace(/^['‘’]+|['‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 3 || text.length > EPITAPH_MAX) return undefined;
  if (/[\p{C}<>]/u.test(text) || BLOCKED.test(text)) return undefined;
  return text;
}

/**
 * Writes epitaphs with the language model, off the screen-generation path: a room opening asks
 * for its pending graves, and one grave at a time is written and committed, which also shows it
 * to everyone on that screen. Each grave is tried once per server run, so two players arriving
 * together never start two; a grave whose try failed keeps its seed epitaph and is tried again
 * after a restart.
 */
export function epitaphWriter(store: TraceStore, writeText: WriteText) {
  const tried = new Set<string>();
  let queue: Promise<void> = Promise.resolve();
  let stopped = false;

  async function write(coord: ScreenCoord, grave: Epitaph, world: World, biome: Biome) {
    if (stopped) return;
    const ground = landmarkAround(world, coord, grave);
    const request = epitaphPrompt(
      graveName(world, coord, grave),
      biome,
      ground && LANDMARK_NOUNS[ground],
    );
    const result = await writeText(request);
    const text = result.kind === 'ok' ? cleanEpitaph(result.text) : undefined;
    if (stopped) return;
    if (text === undefined) {
      const why = result.kind === 'ok' ? `filtered "${result.text}"` : result.kind;
      console.warn(`Epitaph at ${grave.tx},${grave.ty} on ${screenKey(coord)}: ${why}`);
      return;
    }
    const now = store.get(coord, grave, 'epitaph');
    if (now?.source !== 'pending') return;
    store.commit(coord, [{ put: { ...now, text, source: 'model' } }], null);
  }

  return {
    request(place: Place, world: World): void {
      const { coord, biome } = place.screen;
      for (const trace of place.traces.values()) {
        if (trace.kind !== 'epitaph' || trace.source !== 'pending') continue;
        const key = `${screenKey(coord)}:${trace.tx},${trace.ty}`;
        if (tried.has(key)) continue;
        tried.add(key);
        queue = queue
          .then(() => write(coord, trace, world, biome))
          .catch((error: unknown) => console.error('Epitaph write failed', error));
      }
    },
    /** Resolves once every epitaph asked for so far is written or given up. */
    idle: (): Promise<void> => queue,
    stop(): void {
      stopped = true;
    },
  };
}

export type EpitaphWriter = ReturnType<typeof epitaphWriter>;

type Row = { layer: string; sx: number; sy: number; tx: number; ty: number; data: string };

export type StoredEpitaph = { coord: ScreenCoord; tile: Tile; text: string; source: string };

const epitaphOf = (row: Row) => {
  const parsed = traceSchema.safeParse(JSON.parse(row.data));
  return parsed.success && parsed.data.kind === 'epitaph' ? parsed.data : undefined;
};

export function listEpitaphs(db: DatabaseSync): StoredEpitaph[] {
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
  db: DatabaseSync,
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
