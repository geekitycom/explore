import type { DatabaseSync } from 'node:sqlite';
import {
  kindsInOrder,
  placeOf,
  resolve,
  screenKey,
  traceSchema,
  withChanges,
  type Act,
  type Here,
  type Place,
  type Screen,
  type ScreenCoord,
  type Trace,
  type TraceChange,
  type World,
} from '@explore/core';
import { saveInventory } from './inventory.ts';
import type { Player, Presence } from './presence.ts';

function parseRow(data: string): Trace | undefined {
  try {
    const parsed = traceSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** The one write path for traces: every change lands in the database and in the open room. */
export class TraceStore {
  readonly #db: DatabaseSync;
  readonly #presence: Presence;

  constructor(db: DatabaseSync, presence: Presence) {
    this.#db = db;
    this.#presence = presence;
  }

  /**
   * Loads the screen's traces and adds what each kind settles on it. A row that no longer
   * parses is skipped and kept, so a later deploy that understands it again finds it (D22).
   */
  open(coord: ScreenCoord, screen: Screen, world: World): Place {
    const rows = this.#db
      .prepare('SELECT tx, ty, kind, data FROM traces WHERE layer = ? AND sx = ? AND sy = ?')
      .all(coord.layer, coord.sx, coord.sy) as {
      tx: number;
      ty: number;
      kind: string;
      data: string;
    }[];
    const traces = rows.flatMap((row) => {
      const trace = parseRow(row.data);
      if (!trace)
        console.warn(`Skipping a ${row.kind} trace at ${row.tx},${row.ty} on ${screenKey(coord)}`);
      return trace ? [trace] : [];
    });
    let place = placeOf(screen, traces);
    const settled: TraceChange[] = [];
    for (const kind of kindsInOrder()) {
      const changes = kind.settle?.(place, world) ?? [];
      if (changes.length === 0) continue;
      settled.push(...changes);
      place = withChanges(place, changes);
    }
    this.commit(coord, settled, null);
    return place;
  }

  /** Safe for a screen nobody is on: the database changes and no room does. */
  commit(coord: ScreenCoord, changes: readonly TraceChange[], by: number | null): void {
    if (changes.length === 0) return;
    const { layer, sx, sy } = coord;
    const put = this.#db.prepare(
      `INSERT INTO traces (layer, sx, sy, tx, ty, kind, data, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (layer, sx, sy, tx, ty, kind) DO UPDATE SET
         data = excluded.data, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    );
    const drop = this.#db.prepare(
      'DELETE FROM traces WHERE layer = ? AND sx = ? AND sy = ? AND tx = ? AND ty = ? AND kind = ?',
    );
    const at = Date.now();
    this.#db.exec('BEGIN');
    try {
      for (const change of changes) {
        if ('put' in change) {
          const { tx, ty, kind } = change.put;
          put.run(layer, sx, sy, tx, ty, kind, JSON.stringify(change.put), by, at);
        } else {
          const { tx, ty, kind } = change.drop;
          drop.run(layer, sx, sy, tx, ty, kind);
        }
      }
      this.#db.exec('COMMIT');
    } catch (error) {
      this.#db.exec('ROLLBACK');
      throw error;
    }
    const room = this.#presence.peek(coord);
    if (!room) return;
    room.place = withChanges(room.place, changes);
    this.#presence.tell(room, { t: 'traces', changes: [...changes] });
  }
}

/**
 * Resolves and commits one player act. Synchronous end to end, so two players acting on one
 * tile are ordered by the event loop.
 */
export function perform(
  db: DatabaseSync,
  store: TraceStore,
  player: Player,
  act: Act,
  now: number,
): void {
  const { room } = player;
  const here: Here = {
    place: room.place,
    me: { id: player.user.id, name: player.user.username, pose: player.pose },
    others: [...room.players].flatMap((other) => (other === player ? [] : [other.pose])),
    inventory: player.inventory,
    now,
  };
  const outcome = resolve(here, act);
  switch (outcome.kind) {
    case 'nothing':
      return;
    case 'refused':
      player.conn.send({ t: 'refused', reason: outcome.reason });
      return;
    case 'done':
      store.commit(room.place.screen.coord, outcome.changes, player.user.id);
      if (outcome.inventory === player.inventory) return;
      player.inventory = outcome.inventory;
      saveInventory(db, player.user.id, outcome.inventory);
      player.conn.send({ t: 'inventory', stacks: [...outcome.inventory] });
  }
}
