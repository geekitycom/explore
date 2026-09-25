import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { openDatabase } from './db.ts';
import { hashPassword } from './password.ts';
import { createSession, sessionUser } from './sessions.ts';
import { insertUser } from './users.ts';
import { wipeWorld } from './wipe.ts';
import { Chunks } from './chunks.ts';
import { ensureGarden, getScreen, loadPlayerState, loadWorld, savePlayerState } from './world.ts';
import { CHUNK_H, CHUNK_W, DEFAULT_AVATAR, GARDEN_COORD, secretGarden } from '@explore/core';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test('wiping keeps accounts, forgets the world, rolls a new seed, and restores the garden', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'explore-wipe-'));
  dirs.push(dir);
  const path = join(dir, 'world.db');
  let db = openDatabase(path);
  ensureGarden(db);
  const user = insertUser(db, {
    username: 'wanderer',
    passwordHash: await hashPassword('correct horse'),
    avatar: DEFAULT_AVATAR,
  })!;
  const { token } = createSession(db, user.id);
  const east = { ...GARDEN_COORD, sx: 1 };
  const before = new Chunks(db).screenAt(east, user.id);
  const seed = loadWorld(db).seed;
  savePlayerState(db, user.id, { coord: east, pose: { x: 50, y: 60, dir: 'e', moving: false } });
  db.close();

  db = openDatabase(path);
  expect(wipeWorld(db)).toEqual({ screens: CHUNK_W * CHUNK_H, players: 1 });
  expect(getScreen(db, east)).toBeUndefined();
  expect(getScreen(db, GARDEN_COORD)).toEqual(secretGarden());
  expect(loadPlayerState(db, user.id)).toBeUndefined();
  expect(sessionUser(db, `session=${token}`)?.username).toBe('wanderer');

  expect(wipeWorld(db)).toEqual({ screens: 1, players: 0 });
  expect(getScreen(db, GARDEN_COORD)).toEqual(secretGarden());
  expect(loadWorld(db).seed).not.toBe(seed);
  expect(new Chunks(db).screenAt(east, user.id)).not.toEqual(before);
  db.close();
});
