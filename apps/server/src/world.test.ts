import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  CHUNK_H,
  CHUNK_W,
  DEFAULT_AVATAR,
  GARDEN_COORD,
  LATTICE_H,
  OVERWORLD,
  SCREEN_W,
  cornerAt,
  encodeScreen,
  generateScreen,
  secretGarden,
  type LayerId,
  type ScreenCoord,
} from '@explore/core';
import { afterEach, expect, it } from 'vitest';
import { Chunks } from './chunks.ts';
import { openDatabase } from './db.ts';
import { insertUser } from './users.ts';
import {
  ensureGarden,
  getScreen,
  loadPlayerState,
  loadWorld,
  savePlayerState,
  upgradeScreenRecords,
} from './world.ts';
import { wipeWorld } from './wipe.ts';

const EAST = { layer: OVERWORLD, sx: 1, sy: 0 };
const CELLAR = 'cellar' as LayerId;
const CHUNK_SCREENS = CHUNK_W * CHUNK_H;

const getOrCreateScreen = (db: DatabaseSync, coord: ScreenCoord, userId: number) =>
  new Chunks(db).screenAt(coord, userId);

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'explore-world-'));
  dirs.push(dir);
  return join(dir, 'explore.db');
}

it('creates a screen once from the world seed, seamless with the garden, and keeps it on disk', () => {
  const path = tempDbPath();
  const db = openDatabase(path);
  ensureGarden(db);
  ensureGarden(db);
  const user = insertUser(db, { username: 'alice', passwordHash: 'x', avatar: DEFAULT_AVATAR })!;

  const east = encodeScreen(getOrCreateScreen(db, EAST, user.id));
  expect(encodeScreen(getOrCreateScreen(db, EAST, user.id))).toEqual(east);
  expect(east).toEqual(encodeScreen(generateScreen(loadWorld(db), EAST)));
  const garden = secretGarden();
  const eastScreen = getScreen(db, EAST)!;
  for (let cy = 0; cy < LATTICE_H; cy++) {
    expect(cornerAt(eastScreen, 0, cy)).toBe(cornerAt(garden, SCREEN_W, cy));
  }
  expect(db.prepare('SELECT COUNT(*) AS n FROM screens').get()).toEqual({ n: CHUNK_SCREENS });
  db.close();

  const reopened = openDatabase(path);
  expect(encodeScreen(getScreen(reopened, EAST)!)).toEqual(east);
  expect(encodeScreen(getScreen(reopened, GARDEN_COORD)!)).toEqual(encodeScreen(garden));
  reopened.close();
});

it('stores screens at the same sx, sy on different layers separately', () => {
  const db = openDatabase(':memory:');
  ensureGarden(db);
  const user = insertUser(db, { username: 'alice', passwordHash: 'x', avatar: DEFAULT_AVATAR })!;
  const cellarOrigin = { layer: CELLAR, sx: 0, sy: 0 };

  const cellar = getOrCreateScreen(db, cellarOrigin, user.id);
  expect(cellar.coord).toEqual(cellarOrigin);
  expect(cellar.features).not.toEqual(secretGarden().features);
  expect(getScreen(db, GARDEN_COORD)).toEqual(secretGarden());
  expect(getScreen(db, { layer: CELLAR, sx: CHUNK_W, sy: 0 })).toBeUndefined();
  expect(db.prepare('SELECT layer, count(*) AS n FROM screens GROUP BY layer').all()).toEqual([
    { layer: 'cellar', n: CHUNK_SCREENS },
    { layer: 'overworld', n: 1 },
  ]);
  db.close();
});

it('saves and resumes the layer a player is on', () => {
  const db = openDatabase(':memory:');
  const user = insertUser(db, { username: 'alice', passwordHash: 'x', avatar: DEFAULT_AVATAR })!;
  const pose = { x: 40, y: 50, dir: 'w' as const, moving: false };
  savePlayerState(db, user.id, { coord: { layer: CELLAR, sx: 2, sy: -1 }, pose });
  expect(loadPlayerState(db, user.id)).toEqual({ coord: { layer: CELLAR, sx: 2, sy: -1 }, pose });
  savePlayerState(db, user.id, { coord: EAST, pose });
  expect(loadPlayerState(db, user.id)).toEqual({ coord: EAST, pose });
  db.close();
});

/** The schema as the first two migrations left it, before screens carried a layer. */
const LAYERLESS_SCHEMA = `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    avatar TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user_id ON sessions(user_id);
  CREATE TABLE screens (
    sx INTEGER NOT NULL,
    sy INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (sx, sy)
  );
  CREATE TABLE player_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    sx INTEGER NOT NULL,
    sy INTEGER NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    dir TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  PRAGMA user_version = 2;`;

it('upgrades an old database in place: accounts, screens, and positions all stay', () => {
  const path = tempDbPath();
  const garden = secretGarden();
  const layerless = (screen: typeof garden) =>
    JSON.stringify({ ...encodeScreen(screen), v: 1, layer: undefined, seed: 7 });
  const old = new DatabaseSync(path);
  old.exec(LAYERLESS_SCHEMA);
  old
    .prepare(
      `INSERT INTO users (id, username, password_hash, avatar, created_at) VALUES (1, 'alice', 'x', ?, 0)`,
    )
    .run(JSON.stringify(DEFAULT_AVATAR));
  const insertScreen = old.prepare(
    'INSERT INTO screens (sx, sy, data, created_by, created_at) VALUES (?, ?, ?, ?, 0)',
  );
  insertScreen.run(0, 0, layerless(garden), null);
  insertScreen.run(1, 0, layerless({ ...garden, coord: EAST }), 1);
  old
    .prepare(
      `INSERT INTO player_state (user_id, sx, sy, x, y, dir, updated_at) VALUES (1, 1, 0, 40, 50, 'w', 0)`,
    )
    .run();
  old.close();

  const db = openDatabase(path);
  expect(db.prepare('SELECT username FROM users').all()).toEqual([{ username: 'alice' }]);
  expect(db.prepare('SELECT COUNT(*) AS n FROM screens').get()).toEqual({ n: 2 });
  expect(Number.isInteger(loadWorld(db).seed)).toBe(true);
  expect(getScreen(db, GARDEN_COORD)).toEqual(garden);
  expect(getScreen(db, EAST)).toEqual({ ...garden, coord: EAST, biome: 'meadow' });
  expect(db.prepare('SELECT gen_version FROM screens').all()).toEqual([
    { gen_version: 0 },
    { gen_version: 0 },
  ]);
  expect(loadPlayerState(db, 1)).toEqual({
    coord: EAST,
    pose: { x: 40, y: 50, dir: 'w', moving: false },
  });
  expect(upgradeScreenRecords(db)).toBe(0);

  wipeWorld(db);
  expect(loadPlayerState(db, 1)).toBeUndefined();
  expect(getScreen(db, GARDEN_COORD)).toEqual(garden);
  getOrCreateScreen(db, { layer: CELLAR, sx: 0, sy: 0 }, 1);
  expect(db.prepare('SELECT COUNT(*) AS n FROM screens').get()).toEqual({ n: 1 + CHUNK_SCREENS });
  db.close();
});
