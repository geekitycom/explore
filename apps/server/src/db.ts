import { DatabaseSync } from 'node:sqlite';
import { ensureGarden, upgradeScreenRecords } from './world.ts';

declare const kind: unique symbol;

/** The main database: accounts and sessions, one per deployment (decision D25). */
export type MainDb = DatabaseSync & { readonly [kind]: 'main' };

/** A world file: everything inside one world, with user ids as plain integers (D25). */
export type WorldDb = DatabaseSync & { readonly [kind]: 'world' };

/** Schema changes to the main database, one per version. */
const mainMigrations: readonly string[] = [
  `CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    avatar TEXT NOT NULL,
    avatar_chosen INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user_id ON sessions(user_id);`,
];

/**
 * Schema changes to a world file, one per version. A migration may add to or rewrite stored
 * screens and positions, never delete them (decision D22); a world is reset only by
 * pnpm world:wipe --yes.
 */
const worldMigrations: readonly string[] = [
  `CREATE TABLE world (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    seed INTEGER NOT NULL
  );
  INSERT INTO world (id, seed) VALUES (1, abs(random()) % 2147483648);
  CREATE TABLE screens (
    layer TEXT NOT NULL,
    sx INTEGER NOT NULL,
    sy INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_by INTEGER,
    created_at INTEGER NOT NULL,
    gen_version INTEGER NOT NULL,
    PRIMARY KEY (layer, sx, sy)
  );
  CREATE TABLE player_state (
    user_id INTEGER PRIMARY KEY,
    layer TEXT NOT NULL,
    sx INTEGER NOT NULL,
    sy INTEGER NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    dir TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE visits (
    layer TEXT NOT NULL,
    sx INTEGER NOT NULL,
    sy INTEGER NOT NULL,
    PRIMARY KEY (layer, sx, sy)
  ) WITHOUT ROWID;
  CREATE TABLE traces (
    layer TEXT NOT NULL,
    sx INTEGER NOT NULL,
    sy INTEGER NOT NULL,
    tx INTEGER NOT NULL,
    ty INTEGER NOT NULL,
    kind TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_by INTEGER,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (layer, sx, sy, tx, ty, kind)
  ) WITHOUT ROWID;
  CREATE INDEX traces_kind ON traces(kind);
  CREATE TABLE trace_reports (
    id INTEGER PRIMARY KEY,
    layer TEXT NOT NULL,
    sx INTEGER NOT NULL,
    sy INTEGER NOT NULL,
    tx INTEGER NOT NULL,
    ty INTEGER NOT NULL,
    kind TEXT NOT NULL,
    reporter INTEGER,
    snapshot TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE inventories (
    user_id INTEGER PRIMARY KEY,
    items TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );`,
];

export function openMainDatabase(path: string): MainDb {
  const db = open(path) as MainDb;
  migrate(db, mainMigrations);
  return db;
}

/**
 * Opens a world file, applies pending migrations, puts the current garden in, and lifts stored
 * screens to the current record version. A wipe skips the lift, so a record that cannot be
 * lifted never blocks the reset.
 */
export function openWorldDatabase(path: string, { upgradeRecords = true } = {}): WorldDb {
  const db = open(path) as WorldDb;
  migrate(db, worldMigrations);
  ensureGarden(db);
  if (upgradeRecords) upgradeScreenRecords(db);
  return db;
}

function open(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  return db;
}

function migrate(db: DatabaseSync, migrations: readonly string[]): void {
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  for (const [index, sql] of migrations.entries()) {
    if (index < version) continue;
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${index + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
