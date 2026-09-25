import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_AVATAR,
  GARDEN_SPAWN,
  SCREEN_PX_W,
  canOccupy,
  decodeScreen,
  encodeScreen,
  secretGarden,
  type Avatar,
  type LayerId,
  type Pose,
  type ScreenRecord,
  type ServerMessage,
} from '@explore/core';
import { serve } from '@hono/node-server';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createApp } from './app.ts';
import { openDatabase } from './db.ts';
import { createGame } from './play.ts';
import type { Conn } from './presence.ts';
import { insertUser } from './users.ts';
import { savePlayerState } from './world.ts';

type Running = { db: DatabaseSync; base: string; stop: () => Promise<void> };

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function start(dbPath = ':memory:'): Promise<Running> {
  const db = openDatabase(dbPath);
  let clock = 0;
  // Every clock read is a tick later, so each move sees at least one report interval pass.
  const game = createGame(db, { now: () => (clock += 100) });
  const { app, injectWebSocket } = createApp({ db, game });
  let server!: Server;
  const port = await new Promise<number>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, (info) =>
      resolve(info.port),
    ) as Server;
  });
  injectWebSocket(server);
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    db.close();
  };
  cleanups.push(stop);
  return { db, base: `127.0.0.1:${port}`, stop };
}

async function signup(base: string, username: string): Promise<string> {
  const res = await fetch(`http://${base}/api/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'correct horse battery', avatar: DEFAULT_AVATAR }),
  });
  expect(res.status).toBe(201);
  return /^session=[^;]*/.exec(res.headers.get('set-cookie') ?? '')![0];
}

type Client = {
  next: () => Promise<ServerMessage>;
  send: (message: unknown) => void;
  close: () => Promise<void>;
  closed: Promise<{ code: number; reason: string }>;
};

async function connect(base: string, cookie: string): Promise<Client> {
  const ws = new WebSocket(`ws://${base}/ws`, { headers: { cookie } });
  const inbox: ServerMessage[] = [];
  const waiting: ((message: ServerMessage) => void)[] = [];
  ws.addEventListener('message', ({ data }) => {
    if (typeof data !== 'string') throw new Error('expected a text frame');
    const message = JSON.parse(data) as ServerMessage;
    const waiter = waiting.shift();
    if (waiter) waiter(message);
    else inbox.push(message);
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) =>
    ws.on('close', (code, reason) => resolve({ code, reason: String(reason) })),
  );
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  const client: Client = {
    next: () => {
      const queued = inbox.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('no message within 2s')), 2000);
        waiting.push((message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
    },
    send: (message) => ws.send(typeof message === 'string' ? message : JSON.stringify(message)),
    close: async () => {
      ws.close();
      await closed;
    },
    closed,
  };
  cleanups.push(() => {
    ws.terminate();
  });
  return client;
}

/** The first message other than someone walking, which a walk's worth of `moved` precedes. */
async function nextAfterMoves(client: Client): Promise<ServerMessage> {
  for (;;) {
    const message = await client.next();
    if (message.t !== 'moved') return message;
  }
}

async function nextOf<T extends ServerMessage['t']>(
  client: Client,
  t: T,
): Promise<Extract<ServerMessage, { t: T }>> {
  const message = await client.next();
  expect(message.t).toBe(t);
  return message as Extract<ServerMessage, { t: T }>;
}

const SPAWN: Pose = { ...GARDEN_SPAWN, moving: false };
const STEP_PX = 7;

/** Sends move reports no farther apart than a walking player would, ending at each waypoint. */
function walk(client: Client, from: { x: number; y: number }, ...waypoints: [number, number][]) {
  let at = from;
  for (const [x, y] of waypoints) {
    const steps = Math.ceil(Math.hypot(x - at.x, y - at.y) / STEP_PX);
    for (let i = 1; i <= steps; i++) {
      client.send({
        t: 'move',
        x: at.x + ((x - at.x) * i) / steps,
        y: at.y + ((y - at.y) * i) / steps,
        dir: 'e',
        moving: true,
      });
    }
    at = { x, y };
  }
  return at;
}

/** A garden route from the spawn to the east edge that avoids the pond and the hedges. */
const TO_EAST_EDGE: [number, number][] = [
  [200, 202],
  [200, 120],
  [316, 120],
];

/**
 * A move far too fast to accept draws a `correct`, so when it is the next message this
 * client received nothing in between.
 */
async function expectNothingPending(client: Client) {
  client.send({ t: 'move', x: 0, y: 0, dir: 'n', moving: true });
  expect((await client.next()).t).toBe('correct');
}

async function travelEast(client: Client) {
  walk(client, SPAWN, ...TO_EAST_EDGE);
  client.send({ t: 'travel', dir: 'e' });
  return nextOf(client, 'screen');
}

describe('world socket', () => {
  it('sends the garden on first connect, with the spawn pose and nobody else', async () => {
    const { base } = await start();
    const alice = await connect(base, await signup(base, 'alice'));
    expect(await alice.next()).toEqual({
      t: 'screen',
      screen: encodeScreen(secretGarden()),
      you: SPAWN,
      others: [],
    });
  });

  it('shares join, moved, and leave within a screen and nowhere else', async () => {
    const { base } = await start();
    const [aliceCookie, bobCookie, carolCookie] = [
      await signup(base, 'alice'),
      await signup(base, 'bob'),
      await signup(base, 'carol'),
    ];
    const alice = await connect(base, aliceCookie);
    await nextOf(alice, 'screen');

    const bob = await connect(base, bobCookie);
    const bobScreen = await nextOf(bob, 'screen');
    expect(bobScreen.others).toEqual([{ id: 1, name: 'alice', avatar: DEFAULT_AVATAR, ...SPAWN }]);
    expect(await alice.next()).toEqual({
      t: 'join',
      player: { id: 2, name: 'bob', avatar: DEFAULT_AVATAR, ...SPAWN },
    });

    alice.send({ t: 'move', x: 160, y: 196, dir: 'n', moving: true });
    expect(await bob.next()).toEqual({ t: 'moved', id: 1, x: 160, y: 196, dir: 'n', moving: true });

    const bobArrival = await travelEast(bob);
    expect(bobArrival.screen.sx).toBe(1);
    expect(await nextAfterMoves(alice)).toEqual({ t: 'leave', id: 2 });

    alice.send({ t: 'move', x: 160, y: 190, dir: 'n', moving: false });
    const carol = await connect(base, carolCookie);
    const carolScreen = await nextOf(carol, 'screen');
    expect(carolScreen.others).toEqual([
      { id: 1, name: 'alice', avatar: DEFAULT_AVATAR, x: 160, y: 190, dir: 'n', moving: false },
    ]);
    expect(await alice.next()).toMatchObject({ t: 'join', player: { id: 3 } });
    await carol.close();
    expect(await alice.next()).toEqual({ t: 'leave', id: 3 });

    await expectNothingPending(bob);
    await expectNothingPending(alice);
  });

  it('shows a saved avatar change to the same screen and to later arrivals', async () => {
    const { base } = await start();
    const [aliceCookie, bobCookie, carolCookie, daveCookie] = [
      await signup(base, 'alice'),
      await signup(base, 'bob'),
      await signup(base, 'carol'),
      await signup(base, 'dave'),
    ];
    const carol = await connect(base, carolCookie);
    await nextOf(carol, 'screen');
    await travelEast(carol);
    const alice = await connect(base, aliceCookie);
    await nextOf(alice, 'screen');
    const bob = await connect(base, bobCookie);
    await nextOf(bob, 'screen');
    await nextOf(alice, 'join');

    const avatar: Avatar = { ...DEFAULT_AVATAR, hairStyle: 'bun', shirt: 'purple' };
    const res = await fetch(`http://${base}/api/me/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: aliceCookie },
      body: JSON.stringify({ avatar }),
    });
    expect(res.status).toBe(200);
    expect(await bob.next()).toEqual({ t: 'avatar', id: 1, avatar });

    const dave = await connect(base, daveCookie);
    expect((await nextOf(dave, 'screen')).others).toContainEqual(
      expect.objectContaining({ id: 1, avatar }),
    );

    expect(await alice.next()).toMatchObject({ t: 'join', player: { id: 4 } });
    await expectNothingPending(alice);
    await expectNothingPending(carol);
  });

  it('stores a screen on first visit and returns the identical screen later', async () => {
    const { base, db } = await start();
    const alice = await connect(base, await signup(base, 'alice'));
    const bob = await connect(base, await signup(base, 'bob'));
    await nextOf(alice, 'screen');
    await nextOf(bob, 'screen');
    await nextOf(alice, 'join');

    const first = await travelEast(alice);
    expect(first.screen).toMatchObject({ v: 3, layer: 'overworld', sx: 1, sy: 0 });
    const row = db.prepare('SELECT data, created_by FROM screens WHERE sx = 1 AND sy = 0').get();
    expect(row).toEqual({ data: JSON.stringify(first.screen), created_by: 1 });

    expect(await nextAfterMoves(bob)).toEqual({ t: 'leave', id: 1 });
    const second = await travelEast(bob);
    expect(second.screen).toEqual(first.screen);
    expect(second.others.map((p) => p.id)).toEqual([1]);
  });

  it('lands a traveller just inside the matching edge, on ground the feet fit', async () => {
    const { base } = await start();
    const alice = await connect(base, await signup(base, 'alice'));
    await nextOf(alice, 'screen');

    const arrival = await travelEast(alice);
    const screen = decodeScreen(arrival.screen);
    expect(arrival.you.dir).toBe('e');
    expect(arrival.you.x).toBeLessThan(16 + 12);
    expect(canOccupy(screen, arrival.you.x, arrival.you.y)).toBe(true);

    walk(alice, arrival.you, [2, arrival.you.y]);
    alice.send({ t: 'travel', dir: 'w' });
    const back = await nextOf(alice, 'screen');
    expect(back.screen).toEqual(encodeScreen(secretGarden()));
    expect(back.you).toMatchObject({ x: SCREEN_PX_W - 8, dir: 'w', moving: false });
  });

  it('maps every discovered screen and where the viewer is, only when logged in', async () => {
    const { base } = await start();
    const cookie = await signup(base, 'alice');
    const alice = await connect(base, cookie);
    await nextOf(alice, 'screen');
    const east = await travelEast(alice);

    const res = await fetch(`http://${base}/api/map`, { headers: { cookie } });
    expect(res.status).toBe(200);
    const map = (await res.json()) as {
      layer: string;
      you: { sx: number; sy: number };
      garden: { sx: number; sy: number };
      screens: unknown[];
    };
    expect(map.layer).toBe('overworld');
    expect(map.you).toMatchObject({ sx: 1, sy: 0 });
    expect(map.garden).toMatchObject({ sx: 0, sy: 0 });
    expect(map.screens.map((r) => decodeScreen(r).coord)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sx: 0, sy: 0 }),
        expect.objectContaining({ sx: 1, sy: 0 }),
      ]),
    );
    expect(map.screens).toHaveLength(2);
    expect(map.screens).toContainEqual(east.screen);

    expect((await fetch(`http://${base}/api/map`)).status).toBe(401);
  });

  it('refuses to travel from away from the edge', async () => {
    const { base } = await start();
    const alice = await connect(base, await signup(base, 'alice'));
    await nextOf(alice, 'screen');
    alice.send({ t: 'travel', dir: 'e' });
    expect(await alice.next()).toEqual({ t: 'correct', x: SPAWN.x, y: SPAWN.y });
  });

  it('corrects moves into blocked tiles and moves faster than the speed cap', async () => {
    const { base } = await start();
    const alice = await connect(base, await signup(base, 'alice'));
    const bob = await connect(base, await signup(base, 'bob'));
    await nextOf(alice, 'screen');
    await nextOf(bob, 'screen');
    await nextOf(alice, 'join');

    walk(alice, SPAWN, [90, 202]);
    for (let i = 0; i < 9; i++) await nextOf(bob, 'moved');
    expect(await bob.next()).toMatchObject({ t: 'moved', x: 90, y: 202 });

    alice.send({ t: 'move', x: 80, y: 202, dir: 'w', moving: true });
    expect(await alice.next()).toEqual({ t: 'correct', x: 90, y: 202 });

    alice.send({ t: 'move', x: 130, y: 202, dir: 'e', moving: true });
    expect(await alice.next()).toEqual({ t: 'correct', x: 90, y: 202 });

    alice.send({ t: 'move', x: 96, y: 202, dir: 'e', moving: true });
    expect(await bob.next()).toMatchObject({ t: 'moved', id: 1, x: 96, y: 202 });
  });

  it('ignores messages that are not valid JSON or not in the protocol', async () => {
    const { base } = await start();
    const alice = await connect(base, await signup(base, 'alice'));
    await nextOf(alice, 'screen');
    alice.send('not json');
    alice.send({ t: 'fly', x: 1 });
    alice.send({ t: 'move', x: 9999, y: 0, dir: 'n', moving: true });
    alice.send({ t: 'travel', dir: 'up' });
    await expectNothingPending(alice);
  });

  it('resumes a reconnecting player at the last position', async () => {
    const { base } = await start();
    const cookie = await signup(base, 'alice');
    const alice = await connect(base, cookie);
    await nextOf(alice, 'screen');
    walk(alice, SPAWN, [180, 202]);
    await alice.close();

    const again = await connect(base, cookie);
    const screen = await nextOf(again, 'screen');
    expect(screen.screen.sx).toBe(0);
    expect(screen.you).toEqual({ x: 180, y: 202, dir: 'e', moving: false });
  });

  it('keeps the screen and the position across a restart on a file database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'explore-play-'));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'explore.db');

    const first = await start(path);
    const cookie = await signup(first.base, 'alice');
    const alice = await connect(first.base, cookie);
    await nextOf(alice, 'screen');
    const arrival = await travelEast(alice);
    await alice.close();
    await first.stop();

    const second = await start(path);
    const again = await connect(second.base, cookie);
    const resumed = await nextOf(again, 'screen');
    expect(resumed.screen).toEqual<ScreenRecord>(arrival.screen);
    expect(resumed.you).toEqual(arrival.you);
  });

  it('keeps players on different layers apart, even at the same sx, sy', async () => {
    const { base, db } = await start();
    const cellar = 'cellar' as LayerId;
    const cellarGarden = { ...secretGarden(), coord: { layer: cellar, sx: 0, sy: 0 } };
    db.prepare(
      'INSERT INTO screens (layer, sx, sy, data, created_by, created_at) VALUES (?, 0, 0, ?, NULL, 0)',
    ).run(cellar, JSON.stringify(encodeScreen(cellarGarden)));
    const aliceCookie = await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    savePlayerState(db, 2, { coord: cellarGarden.coord, pose: SPAWN });

    const alice = await connect(base, aliceCookie);
    expect((await nextOf(alice, 'screen')).screen).toMatchObject({ layer: 'overworld', sx: 0 });
    const bob = await connect(base, bobCookie);
    const bobScreen = await nextOf(bob, 'screen');
    expect(bobScreen.screen).toEqual(encodeScreen(cellarGarden));
    expect(bobScreen.others).toEqual([]);

    alice.send({ t: 'move', x: 160, y: 196, dir: 'n', moving: true });
    const bobEast = await travelEast(bob);
    expect(bobEast.screen).toMatchObject({ layer: 'cellar', sx: 1, sy: 0 });
    const aliceEast = await travelEast(alice);
    expect(aliceEast.screen).toMatchObject({ layer: 'overworld', sx: 1, sy: 0 });
    expect(aliceEast.others).toEqual([]);
    expect(aliceEast.screen).not.toEqual({ ...bobEast.screen, layer: 'overworld' });

    await bob.close();
    await expectNothingPending(alice);

    const bobAgain = await connect(base, bobCookie);
    const resumed = await nextOf(bobAgain, 'screen');
    expect(resumed.screen).toEqual(bobEast.screen);
    expect(resumed.you).toEqual(bobEast.you);
    expect(resumed.others).toEqual([]);
    await expectNothingPending(alice);
  });

  it('rejects an upgrade without a valid session', async () => {
    const { base } = await start();
    for (const headers of [{}, { cookie: 'session=forged' }]) {
      const ws = new WebSocket(`ws://${base}/ws`, { headers });
      const error = await new Promise<Error>((resolve, reject) => {
        ws.once('error', resolve);
        ws.once('open', () => reject(new Error('socket opened')));
      });
      expect(error.message).toBe('Unexpected server response: 401');
    }
  });

  it('replaces the previous connection when the same user connects again', async () => {
    const { base } = await start();
    const cookie = await signup(base, 'alice');
    const bob = await connect(base, await signup(base, 'bob'));
    await nextOf(bob, 'screen');
    const first = await connect(base, cookie);
    await nextOf(first, 'screen');
    expect(await bob.next()).toMatchObject({ t: 'join', player: { id: 1 } });

    const second = await connect(base, cookie);
    expect(await first.closed).toEqual({ code: 4000, reason: 'replaced' });
    const screen = await nextOf(second, 'screen');
    expect(screen.others.map((p) => p.id)).toEqual([2]);
    expect(await bob.next()).toEqual({ t: 'leave', id: 1 });
    expect(await bob.next()).toMatchObject({ t: 'join', player: { id: 1 } });

    second.send({ t: 'move', x: 162, y: 202, dir: 'e', moving: true });
    expect(await bob.next()).toMatchObject({ t: 'moved', id: 1, x: 162 });
  });
});

describe('game', () => {
  it('ignores messages from a connection that has been replaced', () => {
    const db = openDatabase(':memory:');
    cleanups.push(() => db.close());
    let clock = 0;
    const game = createGame(db, { now: () => (clock += 100) });
    const user = (username: string) =>
      insertUser(db, { username, passwordHash: 'x', avatar: DEFAULT_AVATAR })!;
    const [alice, bob] = [user('alice'), user('bob')];
    const inbox = (sent: ServerMessage[]): Conn => ({
      send: (message) => sent.push(message),
      close: () => {},
    });
    const bobSaw: ServerMessage[] = [];
    game.connect(bob, inbox(bobSaw));
    const stale = game.connect(alice, inbox([]));
    game.connect(alice, inbox([]));
    bobSaw.length = 0;

    game.receive(stale, JSON.stringify({ t: 'move', x: 162, y: 202, dir: 'e', moving: true }));
    game.disconnect(stale);
    expect(bobSaw).toEqual([]);
  });
});
