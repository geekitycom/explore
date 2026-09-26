import { createHash, randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { parse } from 'hono/utils/cookie';
import { rowToUser, USER_COLUMNS, type User, type UserRow } from './users.ts';

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function createSession(
  db: DatabaseSync,
  userId: number,
  now = Date.now(),
): { token: string; expiresAt: number } {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = now + SESSION_TTL_MS;
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
    hashToken(token),
    userId,
    expiresAt,
  );
  return { token, expiresAt };
}

export function deleteSession(db: DatabaseSync, token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

export function sessionToken(cookieHeader: string | undefined): string | undefined {
  return cookieHeader ? parse(cookieHeader, SESSION_COOKIE)[SESSION_COOKIE] : undefined;
}

export function sessionUser(
  db: DatabaseSync,
  cookieHeader: string | undefined,
  now = Date.now(),
): User | undefined {
  const token = sessionToken(cookieHeader);
  if (!token) return undefined;
  const row = db
    .prepare(
      `SELECT ${USER_COLUMNS} FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .get(hashToken(token), now) as UserRow | undefined;
  return row && rowToUser(row);
}
