import type { DatabaseSync } from 'node:sqlite';
import { avatarSchema, type Avatar } from '@explore/core';

export type User = { id: number; username: string; avatar: Avatar };

export type UserRow = { id: number; username: string; avatar: string };

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    avatar: avatarSchema.parse(JSON.parse(row.avatar)),
  };
}

export function insertUser(
  db: DatabaseSync,
  input: { username: string; passwordHash: string; avatar: Avatar },
): User | undefined {
  const row = db
    .prepare(
      `INSERT INTO users (username, password_hash, avatar, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(username) DO NOTHING
       RETURNING id, username, avatar`,
    )
    .get(input.username, input.passwordHash, JSON.stringify(input.avatar), Date.now()) as
    UserRow | undefined;
  return row && rowToUser(row);
}

export function findUserCredentials(
  db: DatabaseSync,
  username: string,
): { user: User; passwordHash: string } | undefined {
  const row = db
    .prepare('SELECT id, username, avatar, password_hash FROM users WHERE username = ?')
    .get(username) as (UserRow & { password_hash: string }) | undefined;
  return row && { user: rowToUser(row), passwordHash: row.password_hash };
}

export function updateAvatar(db: DatabaseSync, userId: number, avatar: Avatar): User {
  const row = db
    .prepare('UPDATE users SET avatar = ? WHERE id = ? RETURNING id, username, avatar')
    .get(JSON.stringify(avatar), userId) as UserRow;
  return rowToUser(row);
}
