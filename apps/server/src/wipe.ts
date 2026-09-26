import type { WorldDb } from './db.ts';
import { ensureGarden, reseedWorld } from './world.ts';

/**
 * Throws away the generated world, its visits, its traces, every saved position and inventory.
 * Accounts and sessions live in the main database and are untouched. Rolls a new world seed so
 * the next world is a different one, and puts the secret garden back so the next login starts
 * fresh there.
 */
export function wipeWorld(db: WorldDb): {
  screens: number;
  players: number;
  traces: number;
} {
  db.exec('BEGIN');
  try {
    const players = Number(db.prepare('DELETE FROM player_state').run().changes);
    const screens = Number(db.prepare('DELETE FROM screens').run().changes);
    const traces = Number(db.prepare('DELETE FROM traces').run().changes);
    db.prepare('DELETE FROM visits').run();
    db.prepare('DELETE FROM trace_reports').run();
    db.prepare('DELETE FROM inventories').run();
    reseedWorld(db);
    ensureGarden(db);
    db.exec('COMMIT');
    return { screens, players, traces };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
