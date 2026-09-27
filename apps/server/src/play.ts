import {
  GARDEN_COORD,
  GARDEN_SPAWN,
  DEPARTED_CLOSE_CODE,
  REPLACED_CLOSE_CODE,
  SCREEN_PX_H,
  SCREEN_PX_W,
  WALK_SPEED,
  allTraces,
  arrivalPose,
  canWalk,
  clientMessageSchema,
  encodeScreen,
  neighborCoord,
  screenBiome,
  seamOpenings,
  siteOf,
  slotOf,
  wordsOf,
  type Arrival,
  type ClientMessage,
  type Dir,
  type Pose,
  type ScreenCoord,
  type Suggestion,
  type Tile,
} from '@explore/core';
import {
  departurePortal,
  occupied,
  unstuck,
  visitorArrival,
  type VisitorArrival,
} from './arrival.ts';
import { Chunks } from './chunks.ts';
import type { WorldDb } from './db.ts';
import { epitaphScribe } from './epitaphs.ts';
import { loadInventory } from './inventory.ts';
import type { Roster } from './map.ts';
import { Presence, type Conn, type Player } from './presence.ts';
import { TraceStore, perform, reportTrace } from './traces.ts';
import type { User } from './users.ts';
import { landmarkScribe, type Suggester } from './signs.ts';
import { loadPlayerState, loadWorld, recordVisit, savePlayerState } from './world.ts';
import type { Admission } from './worlds.ts';
import { textWriter, type WriteText } from './writer.ts';

/** How far past the speed cap a move may be, absorbing network jitter. */
const SPEED_SLACK = 1.5;
const DISTANCE_SLACK_PX = 4;
/** Caps the move budget so an idle player cannot bank time and jump across walls. */
const MAX_ELAPSED_S = 1;
const EDGE_REACH_PX = 12;
/** A player with no connection for this long has fallen asleep: their next session starts in the garden. */
export const SESSION_TIMEOUT_MS = 10 * 60_000;

const AT_EDGE: Record<Dir, (p: Pose) => boolean> = {
  n: (p) => p.y <= EDGE_REACH_PX,
  s: (p) => p.y >= SCREEN_PX_H - EDGE_REACH_PX,
  w: (p) => p.x <= EDGE_REACH_PX,
  e: (p) => p.x >= SCREEN_PX_W - EDGE_REACH_PX,
};

function parseClientMessage(raw: string): ClientMessage | undefined {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const result = clientMessageSchema.safeParse(json);
  return result.success ? result.data : undefined;
}

const tileOf = ({ tx, ty }: { tx: number; ty: number }) => ({ tx, ty });

const poses = (players: Iterable<Player>) => [...players].map((p) => p.pose);

const visitThrough = ({ pose, portal }: VisitorArrival): [Pose, Arrival] => [
  pose,
  { kind: 'visit', portal },
];

/**
 * How a player comes in. `sessionSince` is when their current session began, on any world (the
 * world host tracks it); a position saved before that, less the timeout, is from an earlier
 * session and is not resumed. Left out, this world alone decides, as before there were visitors.
 */
export type Entry = { role: Admission; sessionSince: number };

export type Game = ReturnType<typeof createGame>;

export function createGame(
  db: WorldDb,
  {
    now = Date.now,
    writeText,
    suggester,
    sessionTimeoutMs = SESSION_TIMEOUT_MS,
    random = Math.random,
  }: {
    now?: () => number;
    writeText?: WriteText | undefined;
    /** Shared by every world on the server, so its limits hold across them. */
    suggester?: Suggester | undefined;
    sessionTimeoutMs?: number;
    /** Picks the visitor's arrival tile; uniform on [0, 1). */
    random?: () => number;
  } = {},
) {
  const chunks = new Chunks(db);
  const presence = new Presence();
  const store = new TraceStore(db, presence);
  const writer = writeText && textWriter(store, writeText, [epitaphScribe, landmarkScribe]);
  const online = new Map<number, Player>();

  const roomAt = (coord: ScreenCoord, userId: number) =>
    presence.roomOrLoad(coord, () => {
      const world = loadWorld(db);
      const place = store.open(coord, chunks.screenAt(coord, userId), world);
      writer?.request(place, world);
      return place;
    });

  const save = (player: Player) =>
    savePlayerState(
      db,
      player.user.id,
      { coord: player.room.place.screen.coord, pose: player.pose },
      now(),
    );

  const isLive = (player: Player) => online.get(player.user.id) === player;

  const sendScreen = (player: Player, arrival: Arrival = { kind: 'none' }) => {
    const { screen } = player.room.place;
    const others = presence.enter(player, arrival.kind === 'visit' ? arrival.portal : undefined);
    player.conn.send({
      t: 'screen',
      screen: encodeScreen(screen),
      traces: allTraces(player.room.place),
      patch: screenBiome(loadWorld(db), screen.coord).cell,
      you: player.pose,
      others,
      inventory: [...player.inventory],
      arrival,
      suggestions: suggester !== undefined,
    });
    chunks.prefetchAround(screen.coord, player.user.id);
  };

  /**
   * Sends visitors back to their own worlds, each through a portal beside them. Every one hears
   * where their portal opens before anyone leaves the screen; the others see each go through it.
   * The server is done with them at once: every client plays the portal from these messages, the
   * leaver's included, whose render loop outlives its socket.
   */
  const depart = (visitors: Player[], reason?: string) => {
    const portals = new Map<Player, Tile>();
    for (const player of visitors) {
      const { room } = player;
      const taken = occupied([...room.players].filter((p) => p !== player).map((p) => p.pose));
      for (const { tx, ty } of portals.values()) taken.add(`${tx},${ty}`);
      const portal = departurePortal(room.place, player.pose, taken);
      portals.set(player, portal);
      player.conn.send({ t: 'depart', portal, ...(reason !== undefined && { reason }) });
    }
    for (const [player, portal] of portals) {
      disconnect(player, portal);
      player.conn.close(DEPARTED_CLOSE_CODE, 'departed');
    }
  };

  const correct = (player: Player) =>
    player.conn.send({ t: 'correct', x: player.pose.x, y: player.pose.y });

  function move(player: Player, pose: Pose): void {
    const elapsed = Math.min((now() - player.acceptedAt) / 1000, MAX_ELAPSED_S);
    const budget = WALK_SPEED * elapsed * SPEED_SLACK + DISTANCE_SLACK_PX;
    const distance = Math.hypot(pose.x - player.pose.x, pose.y - player.pose.y);
    if (distance > budget || !canWalk(player.room.place, player.pose, pose)) {
      correct(player);
      return;
    }
    player.pose = pose;
    player.acceptedAt = now();
    presence.broadcast(player, { t: 'moved', id: player.user.id, ...pose });
  }

  function travel(player: Player, dir: Dir): void {
    if (!AT_EDGE[dir](player.pose)) {
      correct(player);
      return;
    }
    const coord = neighborCoord(player.room.place.screen.coord, dir);
    const room = roomAt(coord, player.user.id);
    const openings = seamOpenings(player.room.place, room.place, dir);
    if (openings.length === 0) {
      const { x, y } = player.pose;
      player.pose = {
        ...player.pose,
        x: Math.min(Math.max(x, 0), SCREEN_PX_W - 1),
        y: Math.min(Math.max(y, 0), SCREEN_PX_H - 1),
      };
      correct(player);
      return;
    }
    const pose = arrivalPose(room.place, dir, player.pose, openings);
    recordVisit(db, coord);
    savePlayerState(db, player.user.id, { coord, pose }, now());
    presence.exit(player);
    player.room = room;
    player.pose = pose;
    player.acceptedAt = now();
    sendScreen(player);
  }

  /** Answers only once the model has, so the game never waits on it. */
  async function suggest(player: Player, n: number): Promise<void> {
    const { place } = player.room;
    const site = siteOf({ place });
    const suggestion: Suggestion = !suggester
      ? { ok: false, reason: 'Nobody here can think of names.' }
      : !site || !wordsOf(site)
        ? { ok: false, reason: 'There is no signpost here.' }
        : await suggester.suggest(player.user.id, site, place.screen);
    if (isLive(player)) player.conn.send({ t: 'suggestion', n, suggestion });
  }

  /** `portal` is set when a visitor leaves through one rather than simply dropping out. */
  function disconnect(player: Player, portal?: Tile): void {
    if (!isLive(player)) return;
    online.delete(player.user.id);
    presence.exit(player, portal);
    save(player);
  }

  return {
    connect(
      user: User,
      conn: Conn,
      { role, sessionSince }: Entry = { role: 'owner', sessionSince: now() },
    ): Player {
      const previous = online.get(user.id);
      if (previous) {
        disconnect(previous);
        previous.conn.close(REPLACED_CLOSE_CODE, 'replaced');
      }
      const saved = loadPlayerState(db, user.id);
      const resumed = saved && saved.seenAt > sessionSince - sessionTimeoutMs ? saved : undefined;
      const room = roomAt(resumed?.coord ?? GARDEN_COORD, user.id);
      const [pose, arrival]: [Pose, Arrival] = resumed
        ? [unstuck(room.place, resumed.pose), { kind: 'none' }]
        : role === 'visitor'
          ? visitThrough(visitorArrival(room.place, occupied(poses(room.players)), random))
          : [{ ...GARDEN_SPAWN, moving: false }, { kind: 'wake' }];
      const inventory = loadInventory(db, user.id);
      recordVisit(db, room.place.screen.coord);
      const player: Player = { user, role, conn, room, pose, acceptedAt: now(), inventory };
      online.set(user.id, player);
      sendScreen(player, arrival);
      return player;
    },

    receive(player: Player, raw: string): void {
      if (!isLive(player)) return;
      const message = parseClientMessage(raw);
      if (!message) return;
      switch (message.t) {
        case 'move':
          move(player, { x: message.x, y: message.y, dir: message.dir, moving: message.moving });
          break;
        case 'travel':
          travel(player, message.dir);
          break;
        case 'interact':
          perform(store, player, { verb: 'interact', tile: tileOf(message) }, now());
          break;
        case 'use': {
          const slot = slotOf(message.slot);
          if (slot !== undefined)
            perform(store, player, { verb: 'use', slot, tile: tileOf(message) }, now());
          break;
        }
        case 'act':
          perform(store, player, { verb: 'act', ...message.action }, now());
          break;
        case 'report':
          reportTrace(db, player, message, now());
          break;
        case 'goHome':
          if (player.role === 'visitor') depart([player]);
          break;
        case 'suggest':
          void suggest(player, message.n);
          break;
      }
    },

    disconnect,

    /** Sends every visitor home through a portal, each with the reason, and closes their sockets. */
    sendVisitorsHome(reason: string): void {
      depart(
        [...online.values()].filter((p) => p.role === 'visitor'),
        reason,
      );
    },

    playerCount: (): number => online.size,

    isOnline: (userId: number): boolean => online.has(userId),

    /** Everyone connected, with where they stand. */
    roster: (): Roster =>
      [...online.values()].map((p) => ({
        id: p.user.id,
        name: p.user.displayName,
        coord: p.room.place.screen.coord,
        pose: p.pose,
      })),

    changeProfile(user: User): void {
      const player = online.get(user.id);
      if (!player) return;
      player.user = user;
      presence.broadcast(player, {
        t: 'profile',
        id: user.id,
        name: user.displayName,
        avatar: user.avatar,
      });
    },

    /** Saves everyone connected, which also keeps them awake across a crash. */
    flush(): void {
      for (const player of online.values()) save(player);
    },

    /**
     * Saves everyone and drops any chunk still being prefetched. Afterwards the game touches the
     * database no more, so a socket that closes late finds its player already gone.
     */
    stop(): void {
      chunks.stop();
      writer?.stop();
      for (const player of online.values()) save(player);
      online.clear();
    },
  };
}
