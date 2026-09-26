import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CHUNK_H,
  CHUNK_W,
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
import { openWorldDatabase, type WorldDb } from './db.ts';
import { userNamed } from './testing.ts';
import { ensureGarden, getScreen, loadPlayerState, loadWorld, savePlayerState } from './world.ts';

const EAST = { layer: OVERWORLD, sx: 1, sy: 0 };
const CELLAR = 'cellar' as LayerId;
const CHUNK_SCREENS = CHUNK_W * CHUNK_H;

const getOrCreateScreen = (db: WorldDb, coord: ScreenCoord, userId: number) =>
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
  const db = openWorldDatabase(path);
  ensureGarden(db);
  ensureGarden(db);
  const user = userNamed(1, 'alice');

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

  const reopened = openWorldDatabase(path);
  expect(encodeScreen(getScreen(reopened, EAST)!)).toEqual(east);
  expect(encodeScreen(getScreen(reopened, GARDEN_COORD)!)).toEqual(encodeScreen(garden));
  reopened.close();
});

it('stores screens at the same sx, sy on different layers separately', () => {
  const db = openWorldDatabase(':memory:');
  const user = userNamed(1, 'alice');
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
  const db = openWorldDatabase(':memory:');
  const user = userNamed(1, 'alice');
  const pose = { x: 40, y: 50, dir: 'w' as const, moving: false };
  savePlayerState(db, user.id, { coord: { layer: CELLAR, sx: 2, sy: -1 }, pose }, 1000);
  expect(loadPlayerState(db, user.id)).toEqual({
    coord: { layer: CELLAR, sx: 2, sy: -1 },
    pose,
    seenAt: 1000,
  });
  savePlayerState(db, user.id, { coord: EAST, pose }, 2000);
  expect(loadPlayerState(db, user.id)).toEqual({ coord: EAST, pose, seenAt: 2000 });
  db.close();
});
