import type { DatabaseSync } from 'node:sqlite';
import { ensureGarden, reseedWorld } from './world.ts';

export type WipeResult = { screens: number; players: number };

/**
 * Throws away the generated world, its visits, and every saved position, keeping accounts and sessions,
 * rolls a new world seed so the next world is a different one, and puts the secret garden back
 * so the next login starts fresh there.
 */
export function wipeWorld(db: DatabaseSync): WipeResult {
  db.exec('BEGIN');
  try {
    const players = Number(db.prepare('DELETE FROM player_state').run().changes);
    const screens = Number(db.prepare('DELETE FROM screens').run().changes);
    db.prepare('DELETE FROM visits').run();
    reseedWorld(db);
    ensureGarden(db);
    db.exec('COMMIT');
    return { screens, players };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
