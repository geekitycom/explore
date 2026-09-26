import type { DatabaseSync } from 'node:sqlite';
import {
  GARDEN_COORD,
  GARDEN_SPAWN,
  REPLACED_CLOSE_CODE,
  SCREEN_PX_H,
  SCREEN_PX_W,
  WALK_SPEED,
  allTraces,
  arrivalPose,
  canOccupy,
  clientMessageSchema,
  encodeScreen,
  neighborCoord,
  screenBiome,
  seamOpenings,
  slotOf,
  type ClientMessage,
  type Dir,
  type Pose,
  type ScreenCoord,
} from '@explore/core';
import { Chunks } from './chunks.ts';
import { epitaphWriter, type WriteText } from './epitaphs.ts';
import { loadInventory } from './inventory.ts';
import { Presence, type Conn, type Player } from './presence.ts';
import { TraceStore, perform, reportTrace } from './traces.ts';
import type { User } from './users.ts';
import { ensureGarden, loadPlayerState, loadWorld, recordVisit, savePlayerState } from './world.ts';

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

export type Game = ReturnType<typeof createGame>;

export function createGame(
  db: DatabaseSync,
  {
    now = Date.now,
    writeText,
    sessionTimeoutMs = SESSION_TIMEOUT_MS,
  }: { now?: () => number; writeText?: WriteText | undefined; sessionTimeoutMs?: number } = {},
) {
  ensureGarden(db);
  const chunks = new Chunks(db);
  const presence = new Presence();
  const store = new TraceStore(db, presence);
  const epitaphs = writeText && epitaphWriter(store, writeText);
  const online = new Map<number, Player>();

  const roomAt = (coord: ScreenCoord, userId: number) =>
    presence.room(coord, () => {
      const world = loadWorld(db);
      const place = store.open(coord, chunks.screenAt(coord, userId), world);
      epitaphs?.request(place, world);
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

  const sendScreen = (player: Player, wake = false) => {
    const { screen } = player.room.place;
    recordVisit(db, screen.coord);
    const others = presence.enter(player);
    player.conn.send({
      t: 'screen',
      screen: encodeScreen(screen),
      traces: allTraces(player.room.place),
      patch: screenBiome(loadWorld(db), screen.coord).cell,
      you: player.pose,
      others,
      inventory: [...player.inventory],
      wake,
    });
    chunks.prefetchAround(screen.coord, player.user.id);
  };

  const correct = (player: Player) =>
    player.conn.send({ t: 'correct', x: player.pose.x, y: player.pose.y });

  function move(player: Player, pose: Pose): void {
    const elapsed = Math.min((now() - player.acceptedAt) / 1000, MAX_ELAPSED_S);
    const budget = WALK_SPEED * elapsed * SPEED_SLACK + DISTANCE_SLACK_PX;
    const distance = Math.hypot(pose.x - player.pose.x, pose.y - player.pose.y);
    if (distance > budget || !canOccupy(player.room.place, pose.x, pose.y)) {
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
      correct(player);
      return;
    }
    const pose = arrivalPose(room.place, dir, player.pose, openings);
    presence.exit(player);
    player.room = room;
    player.pose = pose;
    player.acceptedAt = now();
    sendScreen(player);
    save(player);
  }

  function disconnect(player: Player): void {
    if (!isLive(player)) return;
    online.delete(player.user.id);
    presence.exit(player);
    save(player);
  }

  return {
    connect(user: User, conn: Conn): Player {
      const previous = online.get(user.id);
      if (previous) {
        disconnect(previous);
        previous.conn.close(REPLACED_CLOSE_CODE, 'replaced');
      }
      const saved = loadPlayerState(db, user.id);
      const resumed = saved && now() - saved.seenAt < sessionTimeoutMs ? saved : undefined;
      const player: Player = {
        user,
        conn,
        room: roomAt(resumed?.coord ?? GARDEN_COORD, user.id),
        pose: resumed?.pose ?? { ...GARDEN_SPAWN, moving: false },
        acceptedAt: now(),
        inventory: loadInventory(db, user.id),
      };
      online.set(user.id, player);
      sendScreen(player, !resumed);
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
      }
    },

    disconnect,

    changeAvatar(user: User): void {
      const player = online.get(user.id);
      if (!player) return;
      player.user = user;
      presence.broadcast(player, { t: 'avatar', id: user.id, avatar: user.avatar });
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
      epitaphs?.stop();
      for (const player of online.values()) save(player);
      online.clear();
    },
  };
}
