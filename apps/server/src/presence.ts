import {
  screenKey,
  type Inventory,
  type Place,
  type PlayerView,
  type Pose,
  type ScreenCoord,
  type ServerMessage,
  type Tile,
} from '@explore/core';
import type { User } from './users.ts';
import type { Admission } from './worlds.ts';

export type Conn = {
  send(message: ServerMessage): void;
  close(code: number, reason: string): void;
};

/** `place` is replaced whenever a trace on the screen changes. */
export type Room = { place: Place; readonly players: Set<Player> };

export type Player = {
  user: User;
  /** Whether this world is the player's own or they are visiting it. */
  readonly role: Admission;
  readonly conn: Conn;
  room: Room;
  /** The last accepted pose; every correction sends the player back here. */
  pose: Pose;
  acceptedAt: number;
  inventory: Inventory;
};

function viewOf({ user, pose }: Player): PlayerView {
  return { id: user.id, name: user.displayName, avatar: user.avatar, ...pose };
}

/** Rooms of connected players, one per occupied screen. Events reach only the same room. */
export class Presence {
  readonly #rooms = new Map<string, Room>();

  roomOrLoad(coord: ScreenCoord, load: () => Place): Room {
    return this.#rooms.get(screenKey(coord)) ?? { place: load(), players: new Set() };
  }

  peek(coord: ScreenCoord): Room | undefined {
    return this.#rooms.get(screenKey(coord));
  }

  /**
   * Adds the player to `player.room` and returns everyone who was already there. `portal` is set
   * only when a visitor comes into the world through one.
   */
  enter(player: Player, portal?: Tile): PlayerView[] {
    const { room } = player;
    const others = [...room.players].map(viewOf);
    room.players.add(player);
    this.#rooms.set(screenKey(room.place.screen.coord), room);
    this.broadcast(player, { t: 'join', player: viewOf(player), ...(portal && { portal }) });
    return others;
  }

  /** `portal` is set only when a visitor leaves the world through one. */
  exit(player: Player, portal?: Tile): void {
    const { room } = player;
    room.players.delete(player);
    this.broadcast(player, { t: 'leave', id: player.user.id, ...(portal && { portal }) });
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
