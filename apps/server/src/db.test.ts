import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GARDEN_COORD, type ScreenCoord } from '@explore/core';
import { afterEach, expect, test } from 'vitest';
import { Chunks } from './chunks.ts';
import { openDatabase } from './db.ts';
import { worldMapJson } from './map.ts';
import { findUserCredentials, insertUser } from './users.ts';
import { ensureGarden, savePlayerState } from './world.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test('upgrading a world from before visits maps only the screens players are standing on', () => {
  const dir = mkdtempSync(join(tmpdir(), 'explore-db-'));
  dirs.push(dir);
  const path = join(dir, 'world.db');
  let db = openDatabase(path);
  ensureGarden(db);
  const user = (username: string) => insertUser(db, { username, passwordHash: 'x' })!;
  const [alice, bob, carol] = [user('alice'), user('bob'), user('carol')];
  const east: ScreenCoord = { ...GARDEN_COORD, sx: 1 };
  new Chunks(db).screenAt(east, alice.id);
  const pose = { x: 50, y: 60, dir: 'e', moving: false } as const;
  savePlayerState(db, alice.id, { coord: east, pose });
  savePlayerState(db, bob.id, { coord: east, pose });
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  db.exec(
    `DROP TABLE inventories; DROP TABLE trace_reports; DROP TABLE traces; DROP TABLE visits;
     ALTER TABLE users DROP COLUMN avatar_chosen; PRAGMA user_version = ${version - 3}`,
  );
  db.close();

  db = openDatabase(path);
  const map = JSON.parse(worldMapJson(db, carol.id)) as { screens: { sx: number; sy: number }[] };
  expect(map.screens.map(({ sx, sy }) => [sx, sy])).toEqual([[1, 0]]);
  db.close();
});

test('accounts from before the avatar step count as having chosen their avatar', () => {
  const dir = mkdtempSync(join(tmpdir(), 'explore-db-'));
  dirs.push(dir);
  const path = join(dir, 'world.db');
  let db = openDatabase(path);
  insertUser(db, { username: 'alice', passwordHash: 'x' });
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  db.exec(`ALTER TABLE users DROP COLUMN avatar_chosen; PRAGMA user_version = ${version - 1}`);
  db.close();

  db = openDatabase(path);
  expect(findUserCredentials(db, 'alice')?.user.avatarChosen).toBe(true);
  insertUser(db, { username: 'bob', passwordHash: 'x' });
  expect(findUserCredentials(db, 'bob')?.user.avatarChosen).toBe(false);
  db.close();
});
