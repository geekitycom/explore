import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  GARDEN_COORD,
  OVERWORLD,
  SCREEN_RECORD_VERSION,
  biomeOf,
  encodeScreen,
  generateScreen,
  secretGarden,
  type ScreenCoord,
} from '@explore/core';
import { afterEach, expect, test } from 'vitest';
import { openMainDatabase, openWorldDatabase, type WorldDb } from './db.ts';
import { loadInventory } from './inventory.ts';
import { insertUser } from './users.ts';
import {
  getScreen,
  loadPlayerState,
  loadWorld,
  savePlayerState,
  upgradeScreenRecords,
} from './world.ts';
import { wipeWorld } from './wipe.ts';

const EAST: ScreenCoord = { layer: OVERWORLD, sx: 1, sy: 0 };
const POSE = { x: 50, y: 60, dir: 'e', moving: false } as const;

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'explore-db-'));
  dirs.push(dir);
  return dir;
}

const version = (db: DatabaseSync) =>
  (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;

const pragma = (db: DatabaseSync, name: string) =>
  Object.values(db.prepare(`PRAGMA ${name}`).get() as Record<string, unknown>)[0];

test('each file migrates on its first open and reopens as it is, in WAL mode', () => {
  const dir = tempDir();
  const mainPath = join(dir, 'main.db');
  const worldPath = join(dir, 'world.db');
  const main = openMainDatabase(mainPath);
  const world = openWorldDatabase(worldPath);
  const seed = loadWorld(world).seed;
  expect([version(main), version(world)]).toEqual([2, 1]);
  expect(getScreen(world, GARDEN_COORD)).toEqual(secretGarden());
  main.close();
  world.close();

  const mainAgain = openMainDatabase(mainPath);
  const worldAgain = openWorldDatabase(worldPath);
  expect([version(mainAgain), version(worldAgain)]).toEqual([2, 1]);
  expect(loadWorld(worldAgain).seed).toBe(seed);
  for (const db of [mainAgain, worldAgain]) {
    expect(pragma(db, 'journal_mode')).toBe('wal');
    expect(pragma(db, 'foreign_keys')).toBe(1);
  }
  mainAgain.close();
  worldAgain.close();
});

test('an account from before display names shows its username until it picks a name', () => {
  const path = join(tempDir(), 'main.db');
  const before = new DatabaseSync(path);
  before.exec(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    avatar TEXT NOT NULL,
    avatar_chosen INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  INSERT INTO users (username, password_hash, avatar, created_at) VALUES ('andrewshell', 'x', '{}', 0);
  PRAGMA user_version = 1;`);
  before.close();

  const main = openMainDatabase(path);
  expect(main.prepare('SELECT username, display_name FROM users').all()).toEqual([
    { username: 'andrewshell', display_name: 'andrewshell' },
  ]);
  main.close();
});

test('every world file rolls its own seed', () => {
  const dir = tempDir();
  const seeds = ['a', 'b'].map((name) => {
    const world = openWorldDatabase(join(dir, `${name}.db`));
    const { seed } = loadWorld(world);
    world.close();
    return seed;
  });
  expect(seeds[0]).not.toBe(seeds[1]);
});

test('a deleted account never gives its id to a later one', () => {
  const main = openMainDatabase(':memory:');
  const alice = insertUser(main, { username: 'alice', displayName: 'alice', passwordHash: 'x' })!;
  main.prepare('DELETE FROM users WHERE id = ?').run(alice.id);
  const bob = insertUser(main, { username: 'bob', displayName: 'bob', passwordHash: 'x' })!;
  expect(bob.id).toBeGreaterThan(alice.id);
  main.close();
});

test('a world file has no foreign keys and keeps state for any user id', () => {
  const world = openWorldDatabase(':memory:');
  const tables = world
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all() as { name: string }[];
  expect(tables.map((t) => t.name).sort()).toEqual([
    'inventories',
    'player_state',
    'screens',
    'trace_reports',
    'traces',
    'visits',
    'world',
  ]);
  for (const { name } of tables) {
    expect(world.prepare(`PRAGMA foreign_key_list(${name})`).all()).toEqual([]);
  }
  const stranger = 424242;
  savePlayerState(world, stranger, { coord: EAST, pose: POSE }, 7);
  expect(loadPlayerState(world, stranger)).toEqual({ coord: EAST, pose: POSE, seenAt: 7 });
  expect(loadInventory(world, stranger)).toEqual([]);
  world.close();
});

/** A record as the generator stored it before biomes, at record version 3. */
function storeV3(world: WorldDb, coord: ScreenCoord): void {
  const record: Record<string, unknown> = {
    ...encodeScreen(generateScreen(loadWorld(world), coord)),
  };
  delete record.biome;
  world
    .prepare(
      `INSERT INTO screens (layer, sx, sy, data, created_by, created_at, gen_version)
       VALUES (?, ?, ?, ?, NULL, 0, 0)`,
    )
    .run(coord.layer, coord.sx, coord.sy, JSON.stringify({ ...record, v: 3 }));
}

test('lifts screens stored in an earlier record format when the world opens', () => {
  const path = join(tempDir(), 'world.db');
  let world = openWorldDatabase(path);
  storeV3(world, EAST);
  world.close();

  world = openWorldDatabase(path);
  const { data } = world
    .prepare('SELECT data FROM screens WHERE layer = ? AND sx = ? AND sy = ?')
    .get(EAST.layer, EAST.sx, EAST.sy) as { data: string };
  expect(JSON.parse(data)).toMatchObject({ v: SCREEN_RECORD_VERSION });
  expect(getScreen(world, EAST)?.biome).toBe(biomeOf(loadWorld(world), EAST));
  expect(upgradeScreenRecords(world)).toBe(0);
  world.close();
});

test('a record it cannot lift stops the open, unless a wipe skips the lift', () => {
  const path = join(tempDir(), 'world.db');
  let world = openWorldDatabase(path);
  world
    .prepare(
      `INSERT INTO screens (layer, sx, sy, data, created_by, created_at, gen_version)
       VALUES ('overworld', 1, 0, '{"v":1,"sx":"three"}', NULL, 0, 0)`,
    )
    .run();
  world.close();

  expect(() => openWorldDatabase(path)).toThrow();
  world = openWorldDatabase(path, { upgradeRecords: false });
  expect(wipeWorld(world)).toMatchObject({ screens: 2 });
  world.close();
  world = openWorldDatabase(path);
  expect(getScreen(world, EAST)).toBeUndefined();
  world.close();
});
