import type { DatabaseSync } from 'node:sqlite';
import { ensureGarden } from './world.ts';

export type WipeResult = { screens: number; players: number };

/**
 * Throws away the generated world and every saved position, keeping accounts and sessions,
 * then puts the secret garden back so the next login starts fresh there.
 */
export function wipeWorld(db: DatabaseSync): WipeResult {
  db.exec('BEGIN');
  try {
    const players = Number(db.prepare('DELETE FROM player_state').run().changes);
    const screens = Number(db.prepare('DELETE FROM screens').run().changes);
    ensureGarden(db);
    db.exec('COMMIT');
    return { screens, players };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
