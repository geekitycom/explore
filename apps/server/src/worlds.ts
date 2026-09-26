import { z } from 'zod';
import type { MainDb } from './db.ts';
import type { User } from './users.ts';

declare const brand: unique symbol;

/** A world's id in the registry, separate from its owner's user id (D25). */
export type WorldId = number & { readonly [brand]: 'WorldId' };

/** Parses a world id arriving in a URL. */
export const worldIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .transform((id) => id as WorldId);

/**
 * The world a player owns, created the first time this is asked. Signup, login, and /api/me all
 * ask, so a crash between creating the account and its world only delays the world to the next
 * request.
 */
export function ensureHomeWorld(db: MainDb, userId: number, now = Date.now()): WorldId {
  db.prepare(
    `INSERT INTO worlds (owner_id, host, created_at) VALUES (?, NULL, ?)
     ON CONFLICT (owner_id) DO NOTHING`,
  ).run(userId, now);
  return homeWorld(db, userId)!;
}

export function homeWorld(db: MainDb, userId: number): WorldId | undefined {
  const row = db.prepare('SELECT id FROM worlds WHERE owner_id = ?').get(userId) as
    { id: WorldId } | undefined;
  return row?.id;
}

/** The world owned by the account with this username, for admin scripts. */
export function worldOwnedBy(db: MainDb, username: string): WorldId | undefined {
  const row = db
    .prepare(
      'SELECT worlds.id FROM worlds JOIN users ON users.id = worlds.owner_id WHERE username = ?',
    )
    .get(username) as { id: WorldId } | undefined;
  return row?.id;
}

export type Admission = 'owner' | 'visitor';

/** Who has come in with a world's current code (visitors.ts, held by the world host). */
export type Visitors = { admits(worldId: WorldId, userId: number): boolean };

/**
 * The single access rule: a world admits its owner always, and a visitor while it is open and
 * they came in with its current code. Undefined means the door is shut to this player.
 */
export function admission(
  db: MainDb,
  visitors: Visitors,
  user: User,
  worldId: WorldId,
): Admission | undefined {
  if (homeWorld(db, user.id) === worldId) return 'owner';
  return visitors.admits(worldId, user.id) ? 'visitor' : undefined;
}
