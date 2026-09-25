import { DatabaseSync } from 'node:sqlite';

const migrations: readonly string[] = [
  `CREATE TABLE users (
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
  CREATE INDEX sessions_user_id ON sessions(user_id);`,
  `CREATE TABLE screens (
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
  );`,
  `CREATE TABLE layered_screens (
    layer TEXT NOT NULL,
    sx INTEGER NOT NULL,
    sy INTEGER NOT NULL,
    data TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (layer, sx, sy)
  );
  INSERT INTO layered_screens (layer, sx, sy, data, created_by, created_at)
    SELECT 'overworld', sx, sy, json_set(data, '$.v', 2, '$.layer', 'overworld'),
      created_by, created_at
    FROM screens;
  DROP TABLE screens;
  ALTER TABLE layered_screens RENAME TO screens;
  CREATE TABLE layered_player_state (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    layer TEXT NOT NULL,
    sx INTEGER NOT NULL,
    sy INTEGER NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    dir TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
  INSERT INTO layered_player_state (user_id, layer, sx, sy, x, y, dir, updated_at)
    SELECT user_id, 'overworld', sx, sy, x, y, dir, updated_at FROM player_state;
  DROP TABLE player_state;
  ALTER TABLE layered_player_state RENAME TO player_state;`,
  `CREATE TABLE world (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    seed INTEGER NOT NULL
  );
  INSERT INTO world (id, seed) VALUES (1, abs(random()) % 2147483648);
  DELETE FROM screens;
  DELETE FROM player_state;`,
];

export function openDatabase(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

function migrate(db: DatabaseSync): void {
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
