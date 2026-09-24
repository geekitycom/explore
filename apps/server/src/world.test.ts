import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_AVATAR,
  GARDEN_COORD,
  LATTICE_H,
  SCREEN_W,
  cornerAt,
  encodeScreen,
  secretGarden,
} from '@explore/core';
import { expect, it } from 'vitest';
import { openDatabase } from './db.ts';
import { insertUser } from './users.ts';
import { ensureGarden, getOrCreateScreen, getScreen } from './world.ts';

it('creates a screen once, seamless with its stored neighbor, and keeps it on disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'explore-world-'));
  try {
    const path = join(dir, 'explore.db');
    const db = openDatabase(path);
    ensureGarden(db);
    ensureGarden(db);
    const user = insertUser(db, { username: 'alice', passwordHash: 'x', avatar: DEFAULT_AVATAR })!;

    const east = encodeScreen(getOrCreateScreen(db, { sx: 1, sy: 0 }, user.id));
    expect(encodeScreen(getOrCreateScreen(db, { sx: 1, sy: 0 }, user.id))).toEqual(east);
    const garden = secretGarden();
    const eastScreen = getScreen(db, { sx: 1, sy: 0 })!;
    for (let cy = 0; cy < LATTICE_H; cy++) {
      expect(cornerAt(eastScreen, 0, cy)).toBe(cornerAt(garden, SCREEN_W, cy));
    }
    expect(db.prepare('SELECT COUNT(*) AS n FROM screens').get()).toEqual({ n: 2 });
    db.close();

    const reopened = openDatabase(path);
    expect(encodeScreen(getScreen(reopened, { sx: 1, sy: 0 })!)).toEqual(east);
    expect(encodeScreen(getScreen(reopened, GARDEN_COORD)!)).toEqual(encodeScreen(garden));
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
