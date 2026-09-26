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
import { worldMapJson } from './map.ts';
import {
  ensureGarden,
  getScreen,
  loadPlayerState,
  loadWorld,
  recordVisit,
  savePlayerState,
} from './world.ts';
import { CHUNK_H, CHUNK_W, GARDEN_COORD, parseInventory, secretGarden } from '@explore/core';
import { loadInventory, saveInventory } from './inventory.ts';
import { Presence } from './presence.ts';
import { TraceStore } from './traces.ts';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test('wiping keeps accounts, forgets the world and its traces, rolls a new seed, and restores the garden', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'explore-wipe-'));
  dirs.push(dir);
  const path = join(dir, 'world.db');
  let db = openDatabase(path);
  ensureGarden(db);
  const user = insertUser(db, {
    username: 'wanderer',
    passwordHash: await hashPassword('correct horse'),
  })!;
  const { token } = createSession(db, user.id);
  const east = { ...GARDEN_COORD, sx: 1 };
  const before = new Chunks(db).screenAt(east, user.id);
  const seed = loadWorld(db).seed;
  savePlayerState(db, user.id, { coord: east, pose: { x: 50, y: 60, dir: 'e', moving: false } });
  recordVisit(db, east);
  new TraceStore(db, new Presence()).commit(
    GARDEN_COORD,
    [{ put: { kind: 'probe', tx: 5, ty: 5, by: user.id } }],
    user.id,
  );
  db.prepare(
    `INSERT INTO trace_reports (layer, sx, sy, tx, ty, kind, reporter, snapshot, created_at)
     VALUES ('overworld', 0, 0, 5, 5, 'probe', ?, '{}', 0)`,
  ).run(user.id);
  saveInventory(db, user.id, parseInventory([{ kind: 'probe', variant: 'probe', count: 1 }]));
  db.close();

  db = openDatabase(path);
  expect(wipeWorld(db)).toEqual({ screens: CHUNK_W * CHUNK_H, players: 1, traces: 1 });
  const count = (table: string) =>
    (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
  expect([count('traces'), count('trace_reports'), count('inventories')]).toEqual([0, 0, 0]);
  expect(loadInventory(db, user.id)).toEqual([]);
  expect(getScreen(db, east)).toBeUndefined();
  expect(getScreen(db, GARDEN_COORD)).toEqual(secretGarden());
  expect(loadPlayerState(db, user.id)).toBeUndefined();
  expect(JSON.parse(worldMapJson(db, user.id))).toMatchObject({ screens: [] });
  expect(sessionUser(db, `session=${token}`)?.username).toBe('wanderer');

  expect(wipeWorld(db)).toEqual({ screens: 1, players: 0, traces: 0 });
  expect(getScreen(db, GARDEN_COORD)).toEqual(secretGarden());
  expect(loadWorld(db).seed).not.toBe(seed);
  expect(new Chunks(db).screenAt(east, user.id)).not.toEqual(before);
  db.close();
});
