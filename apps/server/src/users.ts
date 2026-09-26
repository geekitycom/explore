import type { DatabaseSync } from 'node:sqlite';
import { avatarSchema, DEFAULT_AVATAR, type Avatar } from '@explore/core';

/** `avatarChosen` is false from sign-up until the player first saves an avatar. */
export type User = { id: number; username: string; avatar: Avatar; avatarChosen: boolean };

export type UserRow = { id: number; username: string; avatar: string; avatar_chosen: number };

export const USER_COLUMNS = 'users.id, users.username, users.avatar, users.avatar_chosen';

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    avatar: avatarSchema.parse(JSON.parse(row.avatar)),
    avatarChosen: row.avatar_chosen === 1,
  };
}

/** A new account wears the default avatar until the player chooses one. */
export function insertUser(
  db: DatabaseSync,
  input: { username: string; passwordHash: string },
): User | undefined {
  const row = db
    .prepare(
      `INSERT INTO users (username, password_hash, avatar, avatar_chosen, created_at)
       VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(username) DO NOTHING
       RETURNING ${USER_COLUMNS}`,
    )
    .get(input.username, input.passwordHash, JSON.stringify(DEFAULT_AVATAR), Date.now()) as
    UserRow | undefined;
  return row && rowToUser(row);
}

export function findUserCredentials(
  db: DatabaseSync,
  username: string,
): { user: User; passwordHash: string } | undefined {
  const row = db
    .prepare(`SELECT ${USER_COLUMNS}, users.password_hash FROM users WHERE username = ?`)
    .get(username) as (UserRow & { password_hash: string }) | undefined;
  return row && { user: rowToUser(row), passwordHash: row.password_hash };
}

export function updateAvatar(db: DatabaseSync, userId: number, avatar: Avatar): User {
  const row = db
    .prepare(
      `UPDATE users SET avatar = ?, avatar_chosen = 1 WHERE id = ? RETURNING ${USER_COLUMNS}`,
    )
    .get(JSON.stringify(avatar), userId) as UserRow;
  return rowToUser(row);
}
