import type { DatabaseSync } from 'node:sqlite';
import {
  GARDEN_COORD,
  GARDEN_SPAWN,
  SCREEN_PX_H,
  SCREEN_PX_W,
  WALK_SPEED,
  arrivalPose,
  canOccupy,
  clientMessageSchema,
  crossingTiles,
  encodeScreen,
  neighborCoord,
  screenBiome,
  type ClientMessage,
  type Dir,
  type Pose,
  type ScreenCoord,
} from '@explore/core';
import { Chunks } from './chunks.ts';
import { Presence, type Conn, type Player } from './presence.ts';
import type { User } from './users.ts';
import { ensureGarden, loadPlayerState, loadWorld, savePlayerState } from './world.ts';

/** How far past the speed cap a move may be, absorbing network jitter. */
const SPEED_SLACK = 1.5;
const DISTANCE_SLACK_PX = 4;
/** Caps the move budget so an idle player cannot bank time and jump across walls. */
const MAX_ELAPSED_S = 1;
const EDGE_REACH_PX = 12;

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

export type Game = ReturnType<typeof createGame>;

export function createGame(db: DatabaseSync, { now = Date.now }: { now?: () => number } = {}) {
  ensureGarden(db);
  const chunks = new Chunks(db);
  const presence = new Presence();
  const online = new Map<number, Player>();

  const roomAt = (coord: ScreenCoord, userId: number) =>
    presence.room(coord, () => chunks.screenAt(coord, userId));

  const save = (player: Player) => {
    savePlayerState(db, player.user.id, { coord: player.room.screen.coord, pose: player.pose });
    player.dirty = false;
  };

  const isLive = (player: Player) => online.get(player.user.id) === player;

  /** Sends the player's screen, then builds the chunks they could walk into next. */
  const sendScreen = (player: Player) => {
    const others = presence.enter(player);
    player.conn.send({
      t: 'screen',
      screen: encodeScreen(player.room.screen),
      patch: screenBiome(loadWorld(db), player.room.screen.coord).cell,
      you: player.pose,
      others,
    });
    chunks.prefetchAround(player.room.screen.coord, player.user.id);
  };

  const correct = (player: Player) =>
    player.conn.send({ t: 'correct', x: player.pose.x, y: player.pose.y });

  function move(player: Player, pose: Pose): void {
    const elapsed = Math.min((now() - player.acceptedAt) / 1000, MAX_ELAPSED_S);
    const budget = WALK_SPEED * elapsed * SPEED_SLACK + DISTANCE_SLACK_PX;
    const distance = Math.hypot(pose.x - player.pose.x, pose.y - player.pose.y);
    if (distance > budget || !canOccupy(player.room.screen, pose.x, pose.y)) {
      correct(player);
      return;
    }
    player.pose = pose;
    player.acceptedAt = now();
    player.dirty = true;
    presence.broadcast(player, { t: 'moved', id: player.user.id, ...pose });
  }

  function travel(player: Player, dir: Dir): void {
    if (!AT_EDGE[dir](player.pose)) {
      correct(player);
      return;
    }
    const coord = neighborCoord(player.room.screen.coord, dir);
    const room = roomAt(coord, player.user.id);
    presence.exit(player);
    player.room = room;
    player.pose = arrivalPose(room.screen, dir, player.pose, crossingTiles(loadWorld(db), coord));
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
        previous.conn.close(4000, 'replaced');
      }
      const saved = loadPlayerState(db, user.id);
      const player: Player = {
        user,
        conn,
        room: roomAt(saved?.coord ?? GARDEN_COORD, user.id),
        pose: saved?.pose ?? { ...GARDEN_SPAWN, moving: false },
        acceptedAt: now(),
        dirty: false,
      };
      online.set(user.id, player);
      sendScreen(player);
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
      }
    },

    disconnect,

    /** Shows a player's saved avatar change to everyone on their screen. */
    changeAvatar(user: User): void {
      const player = online.get(user.id);
      if (!player) return;
      player.user = user;
      presence.broadcast(player, { t: 'avatar', id: user.id, avatar: user.avatar });
    },

    /** Saves every pose that moved since its last save. */
    flush(): void {
      for (const player of online.values()) if (player.dirty) save(player);
    },

    /** Drops any chunk still being prefetched; the next approach builds it again. */
    stop(): void {
      chunks.stop();
    },
  };
}
