import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  CHUNK_H,
  CHUNK_W,
  DIRS,
  DIR_DELTA,
  GARDEN_COORD,
  GARDEN_SPAWN,
  GENERATOR_VERSION,
  LATTICE_H,
  LATTICE_W,
  OVERWORLD,
  SCREEN_H,
  SCREEN_RECORD_VERSION,
  SCREEN_W,
  TILE,
  bare,
  chunkScreens,
  cornerAt,
  inScreen,
  isTileWalkable,
  neighborCoord,
  screenKey,
  seamOpenings,
  secretGarden,
  type Screen,
  type ScreenCoord,
} from '@explore/core';
import { afterEach, expect, it } from 'vitest';
import { Chunks } from './chunks.ts';
import { openDatabase } from './db.ts';
import { wipeWorld } from './wipe.ts';
import { ensureGarden, getScreen, loadPlayerState } from './world.ts';

const FIXTURE = readFileSync(new URL('../fixtures/world-v3.sql', import.meta.url), 'utf8');
const FIXTURE_SCREENS = 40;
const STANDING: ScreenCoord = { layer: OVERWORLD, sx: 1, sy: 1 };

type Row = { sx: number; sy: number; data: string; created_by: number | null; gen_version: number };

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A file database holding the dumped world, as the server would find it on disk. */
function legacyDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'explore-legacy-'));
  dirs.push(dir);
  const path = join(dir, 'explore.db');
  const db = new DatabaseSync(path);
  db.exec(FIXTURE);
  db.close();
  return path;
}

const rows = (db: DatabaseSync) =>
  db
    .prepare('SELECT sx, sy, data, created_by, gen_version FROM screens ORDER BY sy, sx')
    .all() as Row[];

const cells = ({ data }: Row) => {
  const { corners, features } = JSON.parse(data) as { corners: string; features: string };
  return { corners, features };
};

it('opens a world from before biomes, upgrading its records in place and keeping the player', () => {
  const path = legacyDbPath();
  const before = new DatabaseSync(path);
  const original = (
    before.prepare('SELECT data FROM screens ORDER BY sy, sx').all() as { data: string }[]
  ).map(({ data }) => JSON.parse(data) as { v: number; corners: string; features: string });
  before.close();
  expect(original).toHaveLength(FIXTURE_SCREENS);
  expect(original.every((r) => r.v === 3)).toBe(true);

  const db = openDatabase(path);
  const upgraded = rows(db);
  expect(upgraded).toHaveLength(FIXTURE_SCREENS);
  upgraded.forEach((row, i) => {
    const record = JSON.parse(row.data) as { v: number; biome?: string };
    expect(record.v).toBe(SCREEN_RECORD_VERSION);
    expect(typeof record.biome).toBe('string');
    expect(cells(row)).toEqual({
      corners: original[i]!.corners,
      features: original[i]!.features,
    });
    expect(row.gen_version).toBe(0);
  });
  expect(getScreen(db, STANDING)?.coord).toEqual(STANDING);
  expect(loadPlayerState(db, 1)).toMatchObject({ coord: STANDING, pose: { dir: 'e' } });
  const once = JSON.stringify(upgraded);
  db.close();

  const again = openDatabase(path);
  expect(JSON.stringify(rows(again))).toBe(once);
  again.close();
});

it('builds new screens around the old ones that share their edges and open onto them', () => {
  const db = openDatabase(legacyDbPath());
  const old = new Map(rows(db).map((row) => [screenKey({ layer: OVERWORLD, ...row }), row]));
  const chunk = { layer: OVERWORLD, cx: 0, cy: 0 };
  const coords = chunkScreens(chunk);
  const kept = coords.filter((c) => old.has(screenKey(c)));
  expect(kept).toHaveLength(8);

  const arrived = new Chunks(db).screenAt({ layer: OVERWORLD, sx: 3, sy: 1 }, 1);
  expect(arrived.coord).toEqual({ layer: OVERWORLD, sx: 3, sy: 1 });

  const now = new Map(rows(db).map((row) => [screenKey({ layer: OVERWORLD, ...row }), row]));
  expect(now.size).toBe(FIXTURE_SCREENS + CHUNK_W * CHUNK_H - kept.length);
  for (const [key, row] of old) expect(now.get(key)).toEqual(row);
  const screens = new Map(coords.map((c) => [screenKey(c), getScreen(db, c)!]));
  const isNew = (c: ScreenCoord) => !old.has(screenKey(c));
  expect(
    coords.filter(isNew).every((c) => now.get(screenKey(c))!.gen_version === GENERATOR_VERSION),
  ).toBe(true);

  const mismatches: string[] = [];
  const closed: string[] = [];
  for (const coord of coords.filter(isNew)) {
    const screen = screens.get(screenKey(coord))!;
    for (const dir of DIRS) {
      const other = getScreen(db, neighborCoord(coord, dir));
      if (!other) continue;
      const { dx, dy } = DIR_DELTA[dir];
      for (let cy = 0; cy < LATTICE_H; cy++) {
        for (let cx = 0; cx < LATTICE_W; cx++) {
          const ox = cx - dx * SCREEN_W;
          const oy = cy - dy * SCREEN_H;
          if (ox < 0 || oy < 0 || ox >= LATTICE_W || oy >= LATTICE_H) continue;
          if (cornerAt(screen, cx, cy) !== cornerAt(other, ox, oy)) {
            mismatches.push(`${screenKey(coord)} ${dir} (${cx},${cy})`);
          }
        }
      }
      if (
        old.has(screenKey(other.coord)) &&
        seamOpenings(bare(other), bare(screen), dir).length === 0
      ) {
        closed.push(`${screenKey(coord)} ${dir}`);
      }
    }
  }
  expect(mismatches).toEqual([]);
  expect(closed).toEqual([]);

  const player = loadPlayerState(db, 1)!;
  const tile: [number, number] = [
    Math.floor(player.pose.x / TILE),
    Math.floor(player.pose.y / TILE),
  ];
  expect([...reachable(screens, player.coord, tile)].sort()).toEqual([...screens.keys()].sort());
  db.close();
});

it('gives a stored garden the new layout, and the old roads north and south still lead into it', () => {
  const db = openDatabase(legacyDbPath());
  const before = rows(db);
  const oldGarden = getScreen(db, GARDEN_COORD)!;
  expect(oldGarden).not.toEqual(secretGarden());

  ensureGarden(db);
  ensureGarden(db);
  expect(getScreen(db, GARDEN_COORD)).toEqual(secretGarden());
  expect(db.prepare('SELECT gen_version FROM screens WHERE sx = 0 AND sy = 0').get()).toEqual({
    gen_version: GENERATOR_VERSION,
  });
  const isGarden = (row: Row) => row.sx === 0 && row.sy === 0;
  expect(rows(db).filter((row) => !isGarden(row))).toEqual(before.filter((row) => !isGarden(row)));

  const screens = new Map(
    rows(db).map((row) => {
      const coord = { layer: OVERWORLD, sx: row.sx, sy: row.sy };
      return [screenKey(coord), getScreen(db, coord)!];
    }),
  );
  const garden = screens.get(screenKey(GARDEN_COORD))!;
  for (const dir of ['n', 's'] as const) {
    const other = screens.get(screenKey(neighborCoord(GARDEN_COORD, dir)))!;
    const facingRow = dir === 'n' ? LATTICE_H - 1 : 0;
    const edge = Array.from({ length: LATTICE_W }, (_, x) => cornerAt(other, x, facingRow));
    expect(edge).toContain('dirt');
    expect(seamOpenings(bare(garden), bare(other), dir).length).toBeGreaterThan(0);
  }
  const spawn: [number, number] = [
    Math.floor(GARDEN_SPAWN.x / TILE),
    Math.floor(GARDEN_SPAWN.y / TILE),
  ];
  const reached = reachable(screens, GARDEN_COORD, spawn);
  expect(reached).toContain(screenKey({ layer: OVERWORLD, sx: 0, sy: -1 }));
  expect(reached).toContain(screenKey({ layer: OVERWORLD, sx: 0, sy: 1 }));
  db.close();
});

it('wipes a world whose records cannot be lifted, so the reset always stays available', () => {
  const path = legacyDbPath();
  const raw = new DatabaseSync(path);
  raw
    .prepare("UPDATE screens SET data = json_set(data, '$.corners', 'x') WHERE sx = 0 AND sy = 1")
    .run();
  raw.close();
  expect(() => openDatabase(path)).toThrow();

  const db = openDatabase(path, { upgradeRecords: false });
  expect(rows(db).every((row) => (JSON.parse(row.data) as { v: number }).v === 3)).toBe(true);
  expect(wipeWorld(db)).toEqual({ screens: FIXTURE_SCREENS, players: 1, traces: 0 });
  expect(rows(db)).toHaveLength(1);
  db.close();
});

/** Screens a player standing on `tile` of `start` can walk to, crossing seams open on both sides. */
function reachable(
  screens: ReadonlyMap<string, Screen>,
  start: ScreenCoord,
  tile: [number, number],
): Set<string> {
  const seen = new Set<string>();
  const reached = new Set<string>();
  const queue: { screen: Screen; tx: number; ty: number }[] = [];
  const visit = (screen: Screen, tx: number, ty: number) => {
    const key = `${screenKey(screen.coord)}:${tx},${ty}`;
    if (!inScreen(tx, ty) || seen.has(key) || !isTileWalkable(screen, tx, ty)) return;
    seen.add(key);
    queue.push({ screen, tx, ty });
  };
  visit(screens.get(screenKey(start))!, ...tile);
  for (let next = queue.shift(); next; next = queue.shift()) {
    const { screen, tx, ty } = next;
    reached.add(screenKey(screen.coord));
    visit(screen, tx + 1, ty);
    visit(screen, tx - 1, ty);
    visit(screen, tx, ty + 1);
    visit(screen, tx, ty - 1);
    for (const dir of DIRS) {
      const { dx, dy } = DIR_DELTA[dir];
      const atEdge =
        (dx > 0 && tx === SCREEN_W - 1) ||
        (dx < 0 && tx === 0) ||
        (dy > 0 && ty === SCREEN_H - 1) ||
        (dy < 0 && ty === 0);
      const other = screens.get(screenKey(neighborCoord(screen.coord, dir)));
      if (!atEdge || !other) continue;
      for (const [ox, oy] of seamOpenings(bare(screen), bare(other), dir)) {
        if (ox + dx * (SCREEN_W - 1) === tx && oy + dy * (SCREEN_H - 1) === ty)
          visit(other, ox, oy);
      }
    }
  }
  return reached;
}
