import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_AVATAR,
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  networkOf,
  type ClientMessage,
  type ScreenCoord,
  type ServerMessage,
} from '@explore/core';
import { openWorldDatabase, type WorldDb } from './db.ts';
import { createGame } from './play.ts';
import type { Player } from './presence.ts';
import type { TextRequest, TextResult } from './text-gen.ts';
import type { User } from './users.ts';
import { loadWorld, savePlayerState } from './world.ts';
import type { WriteText } from './writer.ts';

/**
 * An account as a world sees it, with no users table behind it. The username differs from the
 * display name so a test notices if the username reaches what other players see.
 */
export const userNamed = (id: number, displayName: string): User => ({
  id,
  username: `login${id}`,
  displayName,
  avatar: DEFAULT_AVATAR,
  avatarChosen: true,
});

/** Undoes what a test set up; run them with `afterEach(cleanUp)`. */
const cleanups: (() => void)[] = [];
export const cleanUp = () => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
};

/** A world file in a directory removed after the test. */
export function tempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), 'explore-writing-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'explore.db');
}

/** The screen holding the centre of the graveyard nearest the garden, which is a landmark too. */
export function graveyardScreen(db: WorldDb): ScreenCoord {
  const poi = networkOf(loadWorld(db), OVERWORLD)
    .poisIn({ x0: -800, y0: -600, x1: 800, y1: 600 })
    .filter((p) => p.kind === 'graveyard' || p.kind === 'burialground')
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0]!;
  return { layer: OVERWORLD, sx: Math.floor(poi.x / SCREEN_W), sy: Math.floor(poi.y / SCREEN_H) };
}

type Asked = { request: TextRequest; answer: (result: TextResult) => void };

/**
 * A language model the test answers by hand. `graves` and `signs` are the requests about each,
 * in the order they were asked.
 */
export function fakeModel() {
  const asked: Asked[] = [];
  const writeText: WriteText = (request) =>
    new Promise((answer) => asked.push({ request, answer }));
  const about = (topic: RegExp) => () => asked.filter(({ request }) => isAbout(topic, request));
  const nameIn = (request: TextRequest) =>
    /epitaph for (\w+),/.exec(request.messages.at(-1)!.content)![1]!;
  return { writeText, graves: about(GRAVES), signs: about(SIGNS), nameIn };
}

export const GRAVES = /\bgraves\b/;
export const SIGNS = /\bsignposts\b/;
export const isAbout = (topic: RegExp, request: TextRequest) =>
  topic.test(request.messages[0]!.content);

export type Inbox = ServerMessage[];

const NAMES: Record<number, string> = { 1: 'alice', 2: 'bob' };

/** A game on the world file at `path`, stopped after the test; `join` connects alice (1) or bob (2). */
export function openGame(path: string, options: Parameters<typeof createGame>[1] = {}) {
  const db = openWorldDatabase(path);
  let clock = 0;
  const game = createGame(db, { now: () => (clock += 100), ...options });
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    game.stop();
    db.close();
  };
  cleanups.push(stop);
  const players = new Map<number, Player>();
  const join = (userId: number): Inbox => {
    const inbox: Inbox = [];
    const player = game.connect(userNamed(userId, NAMES[userId]!), {
      send: (m) => inbox.push(m),
      close: () => {},
    });
    players.set(userId, player);
    return inbox;
  };
  const leave = (userId: number) => game.disconnect(players.get(userId)!);
  const send = (userId: number, message: ClientMessage) =>
    game.receive(players.get(userId)!, JSON.stringify(message));
  return { db, game, stop, join, leave, send };
}

/** Saves alice (1) and bob (2) on the graveyard screen and returns it. */
export function atGraveyard(path: string): ScreenCoord {
  const db = openWorldDatabase(path);
  const coord = graveyardScreen(db);
  for (const id of [1, 2])
    savePlayerState(db, id, { coord, pose: { x: 4, y: 4, dir: 's', moving: false } });
  db.close();
  return coord;
}

export const screenOf = (inbox: Inbox) => {
  const screen = inbox.find((m) => m.t === 'screen');
  if (screen?.t !== 'screen') throw new Error('no screen sent');
  return screen;
};

/** Every trace put by a `traces` message in the inbox, in order. */
export const writtenIn = (inbox: Inbox) =>
  inbox.flatMap((m) =>
    m.t === 'traces' ? m.changes.flatMap((c) => ('put' in c ? [c.put] : [])) : [],
  );
