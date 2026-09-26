import { openWorldDatabase, type WorldDb } from './db.ts';
import { createGame, type Game } from './play.ts';
import type { Conn, Player } from './presence.ts';
import type { User } from './users.ts';
import type { WorldId } from './worlds.ts';

/** A world with nobody in it for this long is closed until someone comes back. */
export const IDLE_CLOSE_MS = 5 * 60_000;

export type OpenWorld = { readonly id: WorldId; readonly db: WorldDb; readonly game: Game };

type Options = {
  /** Where world `id` is stored. */
  pathOf: (id: WorldId) => string;
  game?: Parameters<typeof createGame>[1];
  idleMs?: number;
  now?: () => number;
};

export type WorldHost = ReturnType<typeof createWorldHost>;

/**
 * The worlds this server has open, each with its own file and game. A world opens when first
 * asked for and closes once nobody has been in it for a while; opening it again finds its state
 * as it was saved. Nothing here assumes there is one world (D25).
 */
export function createWorldHost({
  pathOf,
  game: gameOptions = {},
  idleMs = IDLE_CLOSE_MS,
  now = Date.now,
}: Options) {
  const worlds = new Map<WorldId, OpenWorld & { emptySince: number }>();

  const close = (world: OpenWorld) => {
    world.game.stop();
    world.db.close();
    worlds.delete(world.id);
  };

  const open = (id: WorldId): OpenWorld => {
    let world = worlds.get(id);
    if (!world) {
      const db = openWorldDatabase(pathOf(id));
      world = { id, db, game: createGame(db, gameOptions), emptySince: now() };
      worlds.set(id, world);
    }
    return world;
  };

  return {
    open,

    openIds: (): WorldId[] => [...worlds.keys()],

    connect(id: WorldId, user: User, conn: Conn): Player {
      return open(id).game.connect(user, conn);
    },

    /** A message for a world already closed is dropped: only a stale socket can send one. */
    receive(id: WorldId, player: Player, raw: string): void {
      worlds.get(id)?.game.receive(player, raw);
    },

    /** Nothing happens for a world already closed: its players were saved when it closed. */
    disconnect(id: WorldId, player: Player): void {
      const world = worlds.get(id);
      if (!world) return;
      world.game.disconnect(player);
      if (world.game.playerCount() === 0) world.emptySince = now();
    },

    changeAvatar(user: User): void {
      for (const world of worlds.values()) world.game.changeAvatar(user);
    },

    /** Saves everyone in every open world. */
    flush(): void {
      for (const world of worlds.values()) world.game.flush();
    },

    /** Closes the worlds nobody has been in for `idleMs`. */
    sweep(): void {
      for (const world of worlds.values()) {
        if (world.game.playerCount() === 0 && now() - world.emptySince >= idleMs) close(world);
      }
    },

    stop(): void {
      for (const world of worlds.values()) close(world);
    },
  };
}
