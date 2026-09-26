import { openWorldDatabase, type WorldDb } from './db.ts';
import { createGame, SESSION_TIMEOUT_MS, type Game } from './play.ts';
import type { Conn, Player } from './presence.ts';
import type { User } from './users.ts';
import { createOpenings, type Opening } from './visitors.ts';
import type { Admission, WorldId } from './worlds.ts';

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

const closedMessage = (hostName: string) => `${hostName} closed their world, so you're back home.`;

/**
 * The worlds this server has open, each with its own file and game. A world opens when first
 * asked for and closes once nobody has been in it for a while; opening it again finds its state
 * as it was saved. Nothing here assumes there is one world (D25).
 *
 * The host also holds which worlds are open for visitors, and each player's session across
 * worlds: a session is a run of connections anywhere with no gap as long as the timeout (D24),
 * so a visit and the walk home are one session.
 */
export function createWorldHost({
  pathOf,
  game: gameOptions = {},
  idleMs = IDLE_CLOSE_MS,
  now = Date.now,
}: Options) {
  const sessionTimeoutMs = gameOptions.sessionTimeoutMs ?? SESSION_TIMEOUT_MS;
  const worlds = new Map<WorldId, OpenWorld & { emptySince: number }>();
  const openings = createOpenings({ now });
  const sessions = new Map<number, { since: number; lastSeen: number }>();

  /** Notes that the player is connected now and returns when their session began. */
  const seen = (userId: number): number => {
    const t = now();
    const session = sessions.get(userId);
    if (session && t - session.lastSeen < sessionTimeoutMs) {
      session.lastSeen = t;
      return session.since;
    }
    sessions.set(userId, { since: t, lastSeen: t });
    return t;
  };

  const inSession = (userId: number): boolean => {
    for (const world of worlds.values()) if (world.game.isOnline(userId)) return true;
    const session = sessions.get(userId);
    return session !== undefined && now() - session.lastSeen < sessionTimeoutMs;
  };

  /** The one way a world stops taking visitors; every visitor in it is sent home. */
  const closeToVisitors = (id: WorldId): void => {
    const opening = openings.close(id);
    if (!opening) return;
    worlds.get(id)?.game.sendVisitorsHome(opening.host.id, closedMessage(opening.host.name));
  };

  const close = (world: OpenWorld) => {
    closeToVisitors(world.id);
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

    /** Going anywhere but home closes the player's own world to visitors. */
    connect(id: WorldId, user: User, conn: Conn, role: Admission): Player {
      for (const hosted of openings.hostedBy(user.id)) if (hosted !== id) closeToVisitors(hosted);
      return open(id).game.connect(user, conn, { role, sessionSince: seen(user.id) });
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
      seen(player.user.id);
      if (world.game.playerCount() === 0) world.emptySince = now();
    },

    changeProfile(user: User): void {
      for (const world of worlds.values()) world.game.changeProfile(user);
    },

    opening: (id: WorldId): Opening => openings.of(id),

    /** Opens the world for visitors, or hands back the code it is already open with. */
    openToVisitors: (id: WorldId, host: User): string =>
      openings.open(id, { id: host.id, name: host.displayName }).code,

    closeToVisitors,

    /** The world a code opens, now admitting the user, or undefined for a code nobody has out. */
    redeemCode(code: string, userId: number): { id: WorldId; host: string } | undefined {
      const opening = openings.redeem(code, userId);
      return opening && { id: opening.worldId, host: opening.host.name };
    },

    admits: (id: WorldId, userId: number): boolean => openings.admits(id, userId),

    /** Saves everyone in every open world, which also keeps their sessions alive. */
    flush(): void {
      for (const world of worlds.values()) {
        world.game.flush();
        for (const { id } of world.game.roster()) seen(id);
      }
    },

    /**
     * Closes the worlds nobody has been in for `idleMs`, and closes to visitors every world whose
     * host has had no connection anywhere for the session timeout.
     */
    sweep(): void {
      for (const id of openings.openWorlds()) {
        const opening = openings.of(id);
        if (opening.state === 'open' && !inSession(opening.host.id)) closeToVisitors(id);
      }
      for (const world of worlds.values()) {
        if (world.game.playerCount() === 0 && now() - world.emptySince >= idleMs) close(world);
      }
    },

    stop(): void {
      for (const world of worlds.values()) close(world);
    },
  };
}
