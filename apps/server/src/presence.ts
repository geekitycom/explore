import {
  screenKey,
  type Inventory,
  type Place,
  type PlayerView,
  type Pose,
  type ScreenCoord,
  type ServerMessage,
} from '@explore/core';
import type { User } from './users.ts';

export type Conn = {
  send(message: ServerMessage): void;
  close(code: number, reason: string): void;
};

/** `place` is replaced whenever a trace on the screen changes. */
export type Room = { place: Place; readonly players: Set<Player> };

export type Player = {
  user: User;
  readonly conn: Conn;
  room: Room;
  /** The last accepted pose; every correction sends the player back here. */
  pose: Pose;
  acceptedAt: number;
  inventory: Inventory;
};

function viewOf({ user, pose }: Player): PlayerView {
  return { id: user.id, name: user.username, avatar: user.avatar, ...pose };
}

/** Rooms of connected players, one per occupied screen. Events reach only the same room. */
export class Presence {
  readonly #rooms = new Map<string, Room>();

  /** The room at `coord`, loading its place only when nobody is there yet. */
  room(coord: ScreenCoord, load: () => Place): Room {
    const key = screenKey(coord);
    let room = this.#rooms.get(key);
    if (!room) {
      room = { place: load(), players: new Set() };
      this.#rooms.set(key, room);
    }
    return room;
  }

  peek(coord: ScreenCoord): Room | undefined {
    return this.#rooms.get(screenKey(coord));
  }

  /** Adds the player to `player.room` and returns everyone who was already there. */
  enter(player: Player): PlayerView[] {
    const others = [...player.room.players].map(viewOf);
    player.room.players.add(player);
    this.broadcast(player, { t: 'join', player: viewOf(player) });
    return others;
  }

  exit(player: Player): void {
    const { room } = player;
    room.players.delete(player);
    this.broadcast(player, { t: 'leave', id: player.user.id });
    if (room.players.size === 0) this.#rooms.delete(screenKey(room.place.screen.coord));
  }

  broadcast(from: Player, message: ServerMessage): void {
    for (const other of from.room.players) if (other !== from) other.conn.send(message);
  }

  /** Everyone in the room, the sender included. */
  tell(room: Room, message: ServerMessage): void {
    for (const player of room.players) player.conn.send(message);
  }
}
