import type { WorldDb } from './db.ts';
import {
  kindNamed,
  kindsInOrder,
  placeOf,
  resolve,
  screenKey,
  traceKey,
  traceSchema,
  withChanges,
  type Act,
  type Inventory,
  type Here,
  type Place,
  type Screen,
  type ScreenCoord,
  type Tile,
  type Trace,
  type TraceKindName,
  type TraceNamed,
  type TraceAddress,
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
  readonly #db: WorldDb;
  readonly #presence: Presence;

  constructor(db: WorldDb, presence: Presence) {
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

  /** The stored trace, which a later deploy or an admin may have changed under an open room. */
  get<K extends TraceKindName>(
    { layer, sx, sy }: ScreenCoord,
    { tx, ty }: Tile,
    kind: K,
  ): TraceNamed<K> | undefined {
    const row = this.#db
      .prepare(
        'SELECT data FROM traces WHERE layer = ? AND sx = ? AND sy = ? AND tx = ? AND ty = ? AND kind = ?',
      )
      .get(layer, sx, sy, tx, ty, kind) as { data: string } | undefined;
    const trace = row && parseRow(row.data);
    return trace?.kind === kind ? (trace as TraceNamed<K>) : undefined;
  }

  /**
   * Safe for a screen nobody is on: the database changes and no room does. An actor's new
   * inventory lands in the same transaction, so a crash can neither duplicate nor lose an item.
   */
  commit(
    coord: ScreenCoord,
    changes: readonly TraceChange[],
    by: number | null,
    inventory?: Inventory,
  ): void {
    if (changes.length === 0 && inventory === undefined) return;
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
      if (inventory !== undefined && by !== null) saveInventory(this.#db, by, inventory);
      this.#db.exec('COMMIT');
    } catch (error) {
      this.#db.exec('ROLLBACK');
      throw error;
    }
    const room = this.#presence.peek(coord);
    if (!room || changes.length === 0) return;
    room.place = withChanges(room.place, changes);
    this.#presence.tell(room, { t: 'traces', changes: [...changes] });
  }
}

/**
 * Resolves and commits one player act. Synchronous end to end, so two players acting on one
 * tile are ordered by the event loop.
 */
export function perform(store: TraceStore, player: Player, act: Act, now: number): void {
  const { room } = player;
  const here: Here = {
    place: room.place,
    me: { id: player.user.id, name: player.user.displayName, pose: player.pose },
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
    case 'done': {
      const changed = outcome.inventory !== player.inventory;
      store.commit(
        room.place.screen.coord,
        outcome.changes,
        player.user.id,
        changed ? outcome.inventory : undefined,
      );
      if (!changed) return;
      player.inventory = outcome.inventory;
      player.conn.send({ t: 'inventory', stacks: [...outcome.inventory] });
    }
  }
}

/**
 * Records a player's report of someone else's words on a trace, keeping the words as they stood
 * so a later rename cannot hide them. The same report of the same words counts once.
 */
export function reportTrace(db: WorldDb, player: Player, address: TraceAddress, now: number): void {
  const { place } = player.room;
  const trace = place.traces.get(traceKey(address, address.kind));
  const said = trace && kindNamed(trace.kind).bubble?.(trace, now);
  if (!trace || !said?.by || said.by.id === player.user.id) return;
  const { layer, sx, sy } = place.screen.coord;
  const row = [
    layer,
    sx,
    sy,
    trace.tx,
    trace.ty,
    trace.kind,
    player.user.id,
    JSON.stringify(trace),
  ];
  db.prepare(
    `INSERT INTO trace_reports (layer, sx, sy, tx, ty, kind, reporter, snapshot, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM trace_reports WHERE layer = ? AND sx = ? AND sy = ? AND tx = ? AND ty = ?
         AND kind = ? AND reporter = ? AND snapshot = ?
     )`,
  ).run(...row, now, ...row);
}
