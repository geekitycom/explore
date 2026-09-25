import type { DatabaseSync } from 'node:sqlite';
import {
  CHUNK_H,
  CHUNK_W,
  DEFAULT_AVATAR,
  GARDEN_COORD,
  GENERATOR_VERSION,
  LATTICE_H,
  LATTICE_W,
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  chunkScreens,
  cornerAt,
  encodeScreen,
  generateScreen,
  screenKey,
  seamOpenings,
  secretGarden,
  type ScreenCoord,
} from '@explore/core';
import { afterEach, expect, it, vi } from 'vitest';
import { Chunks } from './chunks.ts';
import { openDatabase } from './db.ts';
import { insertUser } from './users.ts';
import { ensureGarden, getScreen, loadWorld } from './world.ts';

const CHUNK_SCREENS = CHUNK_W * CHUNK_H;
const at = (sx: number, sy: number): ScreenCoord => ({ layer: OVERWORLD, sx, sy });

/** One turn of the event loop, after which a prefetch has built one more screen. */
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
});

function setup() {
  const db = openDatabase(':memory:');
  ensureGarden(db);
  const generated: string[] = [];
  const chunks = new Chunks(db, (world, coord, older) => {
    generated.push(screenKey(coord));
    return generateScreen(world, coord, older);
  });
  const alice = insertUser(db, { username: 'alice', passwordHash: 'x', avatar: DEFAULT_AVATAR })!;
  const bob = insertUser(db, { username: 'bob', passwordHash: 'x', avatar: DEFAULT_AVATAR })!;
  stops.push(() => {
    chunks.stop();
    db.close();
  });
  return { db, chunks, generated, alice, bob };
}

const stored = (db: DatabaseSync) =>
  (db.prepare('SELECT count(*) AS n FROM screens').get() as { n: number }).n;

const rows = (db: DatabaseSync) =>
  db.prepare('SELECT layer, sx, sy, created_by, gen_version FROM screens').all() as {
    layer: string;
    sx: number;
    sy: number;
    created_by: number | null;
    gen_version: number;
  }[];

it('builds and stores the whole chunk of an unstored screen, recording the generator version', () => {
  const { db, chunks, generated, alice } = setup();

  const east = chunks.screenAt(at(1, 0), alice.id);

  expect(generated).toHaveLength(CHUNK_SCREENS);
  expect(stored(db)).toBe(CHUNK_SCREENS);
  const world = loadWorld(db);
  for (const coord of chunkScreens({ layer: OVERWORLD, cx: 0, cy: 0 })) {
    expect(getScreen(db, coord)).toEqual(generateScreen(world, coord));
  }
  expect(east).toEqual(generateScreen(world, at(1, 0)));
  expect(getScreen(db, GARDEN_COORD)).toEqual(secretGarden());
  const built = rows(db).filter((r) => !(r.sx === 0 && r.sy === 0));
  expect(built).toHaveLength(CHUNK_SCREENS - 1);
  expect(built.every((r) => r.created_by === alice.id && r.gen_version === GENERATOR_VERSION)).toBe(
    true,
  );
});

it('keeps a screen stored by an older generator when its chunk is built around it', () => {
  const { db, chunks, alice } = setup();
  const older = { ...encodeScreen(secretGarden()), sx: 2, sy: 0 };
  db.prepare(
    `INSERT INTO screens (layer, sx, sy, data, created_by, created_at, gen_version)
     VALUES ('overworld', 2, 0, ?, NULL, 0, 0)`,
  ).run(JSON.stringify(older));

  chunks.screenAt(at(1, 0), alice.id);

  expect(stored(db)).toBe(CHUNK_SCREENS);
  expect(encodeScreen(getScreen(db, at(2, 0))!)).toEqual(older);
  expect(rows(db).find((r) => r.sx === 2 && r.sy === 0)).toMatchObject({
    created_by: null,
    gen_version: 0,
  });
  const kept = getScreen(db, at(2, 0))!;
  const west = getScreen(db, at(1, 0))!;
  const east = getScreen(db, at(3, 0))!;
  const south = getScreen(db, at(2, 1))!;
  for (let cy = 0; cy < LATTICE_H; cy++) {
    expect(cornerAt(west, SCREEN_W, cy)).toBe(cornerAt(kept, 0, cy));
    expect(cornerAt(east, 0, cy)).toBe(cornerAt(kept, SCREEN_W, cy));
  }
  for (let cx = 0; cx < LATTICE_W; cx++)
    expect(cornerAt(south, cx, 0)).toBe(cornerAt(kept, cx, SCREEN_H));
  expect(seamOpenings(kept, east, 'e').length).toBeGreaterThan(0);
  expect(seamOpenings(kept, south, 's').length).toBeGreaterThan(0);
});

it('generates a chunk once when two players arrive at it in the same turn', () => {
  const { db, chunks, generated, alice, bob } = setup();
  const world = loadWorld(db);

  const first = chunks.screenAt(at(4, 0), alice.id);
  const second = chunks.screenAt(at(5, 1), bob.id);

  expect(generated).toHaveLength(CHUNK_SCREENS);
  expect(first).toEqual(generateScreen(world, at(4, 0)));
  expect(second).toEqual(generateScreen(world, at(5, 1)));
  expect(stored(db)).toBe(1 + CHUNK_SCREENS);
  expect(new Set(rows(db).map((r) => r.created_by))).toEqual(new Set([null, alice.id]));
});

it('prefetches the chunks around a screen one screen per turn, storing each chunk all at once', async () => {
  const { db, chunks, generated, alice } = setup();

  chunks.prefetchAround(GARDEN_COORD, alice.id);
  expect(generated).toHaveLength(0);
  expect(stored(db)).toBe(1);

  await turn();
  expect(generated).toHaveLength(1);
  for (let i = 1; i < CHUNK_SCREENS - 1; i++) await turn();
  expect(generated).toHaveLength(CHUNK_SCREENS - 1);
  expect(stored(db)).toBe(1);
  await turn();
  expect(generated).toHaveLength(CHUNK_SCREENS);
  expect(stored(db)).toBe(1 + CHUNK_SCREENS);

  for (let i = 0; i < 3 * CHUNK_SCREENS; i++) await turn();
  expect(stored(db)).toBe(4 * CHUNK_SCREENS);
  expect(generated).toHaveLength(4 * CHUNK_SCREENS);
  expect(getScreen(db, GARDEN_COORD)).toEqual(secretGarden());

  await turn();
  chunks.prefetchAround(GARDEN_COORD, alice.id);
  await turn();
  expect(generated).toHaveLength(4 * CHUNK_SCREENS);
});

it('finishes a chunk being prefetched when a player arrives, instead of starting over', async () => {
  const { db, chunks, generated, alice, bob } = setup();
  const world = loadWorld(db);

  chunks.prefetchAround(GARDEN_COORD, alice.id);
  for (let i = 0; i < 5; i++) await turn();
  expect(generated).toHaveLength(5);
  const [chunk] = generated;
  const underWay = chunkScreens({ layer: OVERWORLD, cx: -1, cy: -1 });
  expect(chunk).toBe(screenKey(underWay[0]!));

  const screen = chunks.screenAt(at(-1, -1), bob.id);

  expect(screen).toEqual(generateScreen(world, at(-1, -1)));
  expect(generated).toHaveLength(CHUNK_SCREENS);
  expect(generated).toEqual(underWay.map(screenKey));
  expect(stored(db)).toBe(1 + CHUNK_SCREENS);
  for (const coord of underWay) expect(getScreen(db, coord)).toEqual(generateScreen(world, coord));
  const credited = new Set(rows(db).map((r) => r.created_by));
  expect(credited).toEqual(new Set([null, alice.id]));
});

it('forgets a chunk whose generation failed, so the next approach builds it afresh', async () => {
  const db = openDatabase(':memory:');
  ensureGarden(db);
  const alice = insertUser(db, { username: 'alice', passwordHash: 'x', avatar: DEFAULT_AVATAR })!;
  let failures = 0;
  const chunks = new Chunks(db, (world, coord) => {
    if (failures === 0 && coord.sx === -3 && coord.sy === -4) {
      failures++;
      throw new Error('a generator bug on one screen');
    }
    return generateScreen(world, coord);
  });
  stops.push(() => {
    chunks.stop();
    db.close();
  });
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});

  chunks.prefetchAround(GARDEN_COORD, alice.id);
  for (let i = 0; i < 4 * CHUNK_SCREENS; i++) await turn();

  expect(failures).toBe(1);
  expect(error).toHaveBeenCalledOnce();
  expect(stored(db)).toBe(3 * CHUNK_SCREENS);
  expect(getScreen(db, at(-3, -4))).toBeUndefined();

  const screen = chunks.screenAt(at(-3, -4), alice.id);
  expect(screen).toEqual(generateScreen(loadWorld(db), at(-3, -4)));
  expect(stored(db)).toBe(4 * CHUNK_SCREENS);
  error.mockRestore();
});

it('stops building on stop, leaving nothing half stored, and a fresh store carries on', async () => {
  const { db, chunks, generated, alice } = setup();
  chunks.prefetchAround(GARDEN_COORD, alice.id);
  for (let i = 0; i < 3; i++) await turn();

  chunks.stop();
  for (let i = 0; i < CHUNK_SCREENS; i++) await turn();

  expect(generated).toHaveLength(3);
  expect(stored(db)).toBe(1);

  const again = new Chunks(db);
  stops.push(() => again.stop());
  again.prefetchAround(GARDEN_COORD, alice.id);
  for (let i = 0; i < 4 * CHUNK_SCREENS; i++) await turn();
  expect(stored(db)).toBe(4 * CHUNK_SCREENS);
  expect(generated).toHaveLength(3);
});
