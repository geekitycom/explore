import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CHUNK_H,
  CHUNK_W,
  DEFAULT_AVATAR,
  GARDEN_COORD,
  GARDEN_SPAWN,
  OVERWORLD,
  SCREEN_PX_W,
  TILE,
  bare,
  canOccupy,
  decodeScreen,
  encodeScreen,
  inArea,
  isWalkable,
  landmarkOn,
  parseInventory,
  parseTraces,
  placeOf,
  REASONS,
  REFUSED_CLOSE_CODE,
  DEPARTED_CLOSE_CODE,
  secretGarden,
  siteOf,
  type Avatar,
  type LayerId,
  type Pose,
  type ScreenCoord,
  type ScreenRecord,
  type ServerMessage,
  type Tile,
} from '@explore/core';
import { serve } from '@hono/node-server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import { createApp } from './app.ts';
import { openMainDatabase, openWorldDatabase, type MainDb, type WorldDb } from './db.ts';
import { createWorldHost, type WorldHost } from './host.ts';
import { loadInventory, saveInventory } from './inventory.ts';
import { clearName, landmarkNames } from './names.ts';
import { createGame, type Game } from './play.ts';
import type { Conn } from './presence.ts';
import { userNamed } from './testing.ts';
import type { User } from './users.ts';
import type { WorldId } from './worlds.ts';
import { loadPlayerState, loadWorld, savePlayerState } from './world.ts';

/** Alice signs up first in every test, so her world is the first one registered. */
const ALICE_WORLD = 1 as WorldId;

type Admit = NonNullable<Parameters<typeof createApp>[0]['admit']>;

/** `db` is alice's world file; accounts live in `main`. */
type Running = {
  db: WorldDb;
  main: MainDb;
  host: WorldHost;
  base: string;
  stop: () => Promise<void>;
};

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

/**
 * Unless a test says otherwise, everyone enters every world as its owner, so multiplayer tests
 * need no invitation; `'real'` applies the actual rule (owner, or a visitor with the code).
 */
async function start(dir?: string, admit: Admit | 'real' = () => 'owner'): Promise<Running> {
  const main = openMainDatabase(dir ? join(dir, 'main.db') : ':memory:');
  if (dir) mkdirSync(join(dir, 'worlds'), { recursive: true });
  let clock = 0;
  // Every clock read is a tick later, so each move sees at least one report interval pass.
  const tick = () => (clock += 100);
  const host = createWorldHost({
    pathOf: (id) => (dir ? join(dir, 'worlds', `${id}.db`) : ':memory:'),
    game: { now: tick },
    now: tick,
  });
  const { app, injectWebSocket } = createApp({
    db: main,
    host,
    ...(admit === 'real' ? {} : { admit }),
    scryptCost: { N: 2 ** 4, r: 1, p: 1 },
  });
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
    host.stop();
    main.close();
  };
  cleanups.push(stop);
  return { db: host.open(ALICE_WORLD).db, main, host, base: `127.0.0.1:${port}`, stop };
}

/** Signs up `username` with a capitalized display name, which is all other players see. */
async function signup(base: string, username: string): Promise<string> {
  const displayName = username[0]!.toUpperCase() + username.slice(1);
  const res = await fetch(`http://${base}/api/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, displayName, password: 'correct horse battery' }),
  });
  expect(res.status).toBe(201);
  return /^session=[^;]*/.exec(res.headers.get('set-cookie') ?? '')![0];
}

function post(base: string, path: string, cookie: string) {
  return fetch(`http://${base}${path}`, { method: 'POST', headers: { cookie } });
}

async function login(base: string, username: string): Promise<string> {
  const res = await fetch(`http://${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: 'correct horse battery' }),
  });
  expect(res.status).toBe(200);
  return /^session=[^;]*/.exec(res.headers.get('set-cookie') ?? '')![0];
}

const withinTwoSeconds = <T>(promise: Promise<T>) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('not within 2s')), 2000)),
  ]);

type Client = {
  next: () => Promise<ServerMessage>;
  send: (message: unknown) => void;
  close: () => Promise<void>;
  closed: Promise<{ code: number; reason: string }>;
};

async function connect(
  base: string,
  cookie: string,
  worldId: WorldId = ALICE_WORLD,
): Promise<Client> {
  const ws = new WebSocket(`ws://${base}/ws/worlds/${worldId}`, { headers: { cookie } });
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

type WorldMap = {
  layer: string;
  you: { sx: number; sy: number };
  garden: { sx: number; sy: number } | null;
  names: { x: number; y: number; name: string }[];
  players: { id: number; name: string; x: number; y: number; you: boolean }[];
  screens: ScreenRecord[];
};

async function fetchMap(
  base: string,
  cookie: string,
  worldId: WorldId = ALICE_WORLD,
): Promise<WorldMap> {
  const res = await fetch(`http://${base}/api/worlds/${worldId}/map`, { headers: { cookie } });
  expect(res.status).toBe(200);
  return (await res.json()) as WorldMap;
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

/** Like expectNothingPending, for a client that is watching someone walk. */
async function expectOnlyMovesPending(client: Client) {
  client.send({ t: 'move', x: 0, y: 0, dir: 'n', moving: true });
  expect((await nextAfterMoves(client)).t).toBe('correct');
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
      traces: [],
      patch: { x: 0, y: 0 },
      you: SPAWN,
      others: [],
      inventory: [],
      arrival: { kind: 'wake' },
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
    expect(bobScreen.others).toEqual([{ id: 1, name: 'Alice', avatar: DEFAULT_AVATAR, ...SPAWN }]);
    expect(await alice.next()).toEqual({
      t: 'join',
      player: { id: 2, name: 'Bob', avatar: DEFAULT_AVATAR, ...SPAWN },
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
      { id: 1, name: 'Alice', avatar: DEFAULT_AVATAR, x: 160, y: 190, dir: 'n', moving: false },
    ]);
    expect(await alice.next()).toMatchObject({ t: 'join', player: { id: 3 } });
    await carol.close();
    expect(await alice.next()).toEqual({ t: 'leave', id: 3 });

    await expectNothingPending(bob);
    await expectNothingPending(alice);
  });

  it('shows a saved name and avatar to the same screen and to later arrivals', async () => {
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
    const res = await fetch(`http://${base}/api/me/profile`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', cookie: aliceCookie },
      body: JSON.stringify({ displayName: 'Ali', avatar }),
    });
    expect(res.status).toBe(200);
    expect(await bob.next()).toEqual({ t: 'profile', id: 1, name: 'Ali', avatar });

    const dave = await connect(base, daveCookie);
    expect((await nextOf(dave, 'screen')).others).toContainEqual(
      expect.objectContaining({ id: 1, name: 'Ali', avatar }),
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
    expect(first.screen).toMatchObject({ v: 4, layer: 'overworld', sx: 1, sy: 0 });
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
    expect(canOccupy(bare(screen), arrival.you.x, arrival.you.y)).toBe(true);

    walk(alice, arrival.you, [2, arrival.you.y]);
    alice.send({ t: 'travel', dir: 'w' });
    const back = await nextOf(alice, 'screen');
    expect(back.screen).toEqual(encodeScreen(secretGarden()));
    expect(back.you).toMatchObject({ x: SCREEN_PX_W - 8, dir: 'w', moving: false });
  });

  it('maps the screens players stood on and where the viewer is, only when logged in', async () => {
    const { base, db } = await start();
    const cookie = await signup(base, 'alice');
    const alice = await connect(base, cookie);
    await nextOf(alice, 'screen');
    expect(await fetchMap(base, cookie)).toMatchObject({ screens: [encodeScreen(secretGarden())] });

    const east = await travelEast(alice);
    const map = await fetchMap(base, cookie);
    expect(map.layer).toBe('overworld');
    expect(map.you).toMatchObject({ sx: 1, sy: 0 });
    expect(map.garden).toMatchObject({ sx: 0, sy: 0 });
    expect(map.screens).toEqual([encodeScreen(secretGarden()), east.screen]);
    const { n } = db.prepare('SELECT count(*) AS n FROM screens').get() as { n: number };
    expect(n).toBeGreaterThanOrEqual(CHUNK_W * CHUNK_H);

    const bobCookie = await signup(base, 'bob');
    expect((await fetchMap(base, bobCookie)).screens).toEqual(map.screens);

    expect((await fetch(`http://${base}/api/worlds/1/map`)).status).toBe(401);
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

  it('keeps the screen, the position, and the map across a restart on a file database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'explore-play-'));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    const first = await start(dir);
    const cookie = await signup(first.base, 'alice');
    const alice = await connect(first.base, cookie);
    await nextOf(alice, 'screen');
    const arrival = await travelEast(alice);
    await alice.close();
    await first.stop();

    const second = await start(dir);
    expect((await fetchMap(second.base, cookie)).screens).toEqual([
      encodeScreen(secretGarden()),
      arrival.screen,
    ]);
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
      'INSERT INTO screens (layer, sx, sy, data, created_by, created_at, gen_version) VALUES (?, 0, 0, ?, NULL, 0, 0)',
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

  it('opens and then closes a socket without a valid session, so the browser can tell', async () => {
    const { base } = await start();
    const cookie = await signup(base, 'alice');
    await post(base, '/api/logout', cookie);
    for (const headers of [{}, { cookie: 'session=forged' }, { cookie }]) {
      const ws = new WebSocket(`ws://${base}/ws/worlds/1`, { headers });
      ws.on('error', () => {});
      const closed = new Promise((resolve) =>
        ws.on('close', (code, reason) => resolve({ code, reason: String(reason) })),
      );
      expect(await closed).toEqual({ code: 4401, reason: 'signed out' });
    }
  });

  it("logging out closes every socket opened with that session and no other session's", async () => {
    const { base } = await start();
    const cookie = await signup(base, 'alice');
    const home = await connect(base, cookie, ALICE_WORLD);
    const away = await connect(base, cookie, 2 as WorldId);
    const otherSession = await connect(base, await login(base, 'alice'), 3 as WorldId);
    await nextOf(home, 'screen');
    await nextOf(away, 'screen');
    await nextOf(otherSession, 'screen');

    expect((await post(base, '/api/logout', cookie)).status).toBe(204);

    const signedOut = { code: 4401, reason: 'signed out' };
    expect(await withinTwoSeconds(home.closed)).toEqual(signedOut);
    expect(await withinTwoSeconds(away.closed)).toEqual(signedOut);
    otherSession.send({ t: 'move', x: 162, y: 202, dir: 'e', moving: true });
    await expectNothingPending(otherSession);
    expect(await Promise.race([otherSession.closed, Promise.resolve('still open')])).toBe(
      'still open',
    );
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

/** Two probes, as nothing in play grants one yet. */
const PROBES = parseInventory([{ kind: 'probe', variant: 'probe', count: 2 }]);
const PROBE_STAND = { x: 200, y: 202 };
/** East of PROBE_STAND, where a probe blocks nobody's way. */
const PROBE_TILE = { tx: 13, ty: 12 };

/** Alice (id 1, holding two probes) walks east of the spawn; Bob (id 2) stays at the spawn. */
async function probeGarden(dir?: string) {
  const running = await start(dir);
  const aliceCookie = await signup(running.base, 'alice');
  const bobCookie = await signup(running.base, 'bob');
  saveInventory(running.db, 1, PROBES);
  const alice = await connect(running.base, aliceCookie);
  expect((await nextOf(alice, 'screen')).inventory).toEqual([...PROBES]);
  const bob = await connect(running.base, bobCookie);
  await nextOf(bob, 'screen');
  await nextOf(alice, 'join');
  walk(alice, SPAWN, [PROBE_STAND.x, PROBE_STAND.y]);
  return { ...running, alice, bob, aliceCookie };
}

describe('traces', () => {
  it('shows a placed probe to everyone on the screen and spends it, not only to the placer', async () => {
    const { alice, bob } = await probeGarden();
    alice.send({ t: 'use', slot: 0, ...PROBE_TILE });

    const placed = { t: 'traces', changes: [{ put: { kind: 'probe', ...PROBE_TILE, by: 1 } }] };
    expect(await nextAfterMoves(bob)).toEqual(placed);
    expect(await alice.next()).toEqual(placed);
    expect(await alice.next()).toEqual({
      t: 'inventory',
      stacks: [{ kind: 'probe', variant: 'probe', count: 1 }],
    });
  });

  it('refuses a use out of reach instead of placing a probe across the screen', async () => {
    const { alice, bob } = await probeGarden();
    alice.send({ t: 'use', slot: 0, tx: 5, ty: 5 });
    expect(await alice.next()).toEqual({ t: 'refused', reason: 'Too far away. Walk closer.' });
    await expectNothingPending(alice);
    await expectOnlyMovesPending(bob);
  });

  it('refuses a probe on the tile under someone else instead of trapping them', async () => {
    const { alice, bob } = await probeGarden();
    walk(alice, PROBE_STAND, [184, 202]);
    alice.send({ t: 'use', slot: 0, tx: 10, ty: 12 });
    expect(await alice.next()).toEqual({ t: 'refused', reason: REASONS.someone });
    await expectOnlyMovesPending(bob);
  });

  it('picks a probe back up for everyone and returns it to the hand that took it', async () => {
    const { alice, bob } = await probeGarden();
    alice.send({ t: 'use', slot: 0, ...PROBE_TILE });
    await nextOf(alice, 'traces');
    await nextOf(alice, 'inventory');
    expect((await nextAfterMoves(bob)).t).toBe('traces');

    alice.send({ t: 'interact', ...PROBE_TILE });
    const taken = { t: 'traces', changes: [{ drop: { ...PROBE_TILE, kind: 'probe' } }] };
    expect(await bob.next()).toEqual(taken);
    expect(await alice.next()).toEqual(taken);
    expect(await alice.next()).toEqual({ t: 'inventory', stacks: [...PROBES] });
  });

  it('drops an act whose payload does not parse, yet routes a valid one to its kind', async () => {
    const { alice, bob } = await probeGarden();
    alice.send({ t: 'act', action: { kind: 'probe', input: { tx: 99, ty: 0, label: 'x' } } });
    alice.send({ t: 'act', action: { kind: 'sign', input: {} } });
    alice.send({ t: 'act' });
    await expectNothingPending(alice);

    alice.send({ t: 'act', action: { kind: 'probe', input: { ...PROBE_TILE, label: 'hi' } } });
    expect(await alice.next()).toEqual({ t: 'refused', reason: 'No probe there.' });
    await expectOnlyMovesPending(bob);
  });

  it('keeps a placed probe and the spent inventory across a restart on a file database', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'explore-play-'));
    cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

    const first = await probeGarden(dir);
    first.alice.send({ t: 'use', slot: 0, ...PROBE_TILE });
    await nextOf(first.alice, 'traces');
    await nextOf(first.alice, 'inventory');
    await first.alice.close();
    await first.bob.close();
    await first.stop();

    const second = await start(dir);
    const again = await connect(second.base, first.aliceCookie);
    const resumed = await nextOf(again, 'screen');
    expect(resumed.traces).toEqual([{ kind: 'probe', ...PROBE_TILE, by: 1 }]);
    expect(resumed.inventory).toEqual([{ kind: 'probe', variant: 'probe', count: 1 }]);
  });

  it('skips a stored trace it cannot parse without deleting it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanups.push(() => warn.mockRestore());
    const { base, db } = await start();
    const cookie = await signup(base, 'alice');
    const insert = db.prepare(
      `INSERT INTO traces (layer, sx, sy, tx, ty, kind, data, updated_by, updated_at)
       VALUES ('overworld', 0, 0, ?, ?, ?, ?, NULL, 0)`,
    );
    insert.run(3, 3, 'sign', JSON.stringify({ kind: 'sign', tx: 3, ty: 3 }));
    insert.run(4, 3, 'probe', JSON.stringify({ kind: 'probe', tx: 4, ty: 3, by: 1 }));

    const alice = await connect(base, cookie);
    expect((await nextOf(alice, 'screen')).traces).toEqual([
      { kind: 'probe', tx: 4, ty: 3, by: 1 },
    ]);
    expect(warn).toHaveBeenCalledOnce();
    expect(db.prepare('SELECT kind FROM traces ORDER BY kind').all()).toEqual([
      { kind: 'probe' },
      { kind: 'sign' },
    ]);
  });
});

/** The first screen out from the garden that holds a landmark's centre. */
function landmarkScreen(db: WorldDb): ScreenCoord {
  const world = loadWorld(db);
  for (let r = 1; r < 20; r++) {
    for (let sy = -r; sy <= r; sy++) {
      for (let sx = -r; sx <= r; sx++) {
        const coord = { layer: OVERWORLD, sx, sy };
        if (Math.max(Math.abs(sx), Math.abs(sy)) === r && landmarkOn(world, coord)) return coord;
      }
    }
  }
  throw new Error('no landmark near the garden');
}

/** Standing on `tile`, facing north. */
const poseOn = ({ tx, ty }: Tile): Pose => ({
  x: (tx + 0.5) * TILE,
  y: (ty + 1) * TILE - 2,
  dir: 'n',
  moving: false,
});

/**
 * Alice and Bob beside a landmark's signpost spot. A scout first stands anywhere on the screen,
 * which opens it and settles the landmark there, then Alice and Bob arrive beside the spot. The
 * scout is a third player because the server saves a leaving player's pose once it handles the
 * close, which can land after a pose saved here and would move that player back.
 */
async function atLandmark() {
  const running = await start();
  const { base, db } = running;
  const aliceCookie = await signup(base, 'alice');
  const bobCookie = await signup(base, 'bob');
  const scoutCookie = await signup(base, 'scout');
  const coord = landmarkScreen(db);
  savePlayerState(db, 3, { coord, pose: SPAWN });
  const scout = await connect(base, scoutCookie);
  const seen = await nextOf(scout, 'screen');
  await scout.close();
  const place = placeOf(decodeScreen(seen.screen), parseTraces(seen.traces));
  const site = siteOf({ place })!;
  const stand = [
    { tx: site.tx, ty: site.ty + 1 },
    { tx: site.tx, ty: site.ty - 1 },
    { tx: site.tx + 1, ty: site.ty },
    { tx: site.tx - 1, ty: site.ty },
  ].find((t) => isWalkable(place, t.tx, t.ty) && inArea(site.area, t))!;
  savePlayerState(db, 1, { coord, pose: poseOn(stand) });
  savePlayerState(db, 2, { coord, pose: poseOn(stand) });
  const alice = await connect(base, aliceCookie);
  await nextOf(alice, 'screen');
  const bob = await connect(base, bobCookie);
  await nextOf(bob, 'screen');
  await nextOf(alice, 'join');
  return { ...running, alice, bob, coord, site };
}

const nameIt = (name: string, line = '') => ({
  t: 'act',
  action: { kind: 'landmark', input: { op: 'name', name, line } },
});

describe('landmarks', () => {
  it('lets the first to save name a landmark, and tells the second who did', async () => {
    const { alice, bob, site } = await atLandmark();
    alice.send(nameIt('Old Stones', 'Where the hares run'));
    bob.send(nameIt('Bob Town'));

    const named = {
      t: 'traces',
      changes: [
        {
          put: {
            ...site,
            named: {
              name: 'Old Stones',
              line: 'Where the hares run',
              by: { id: 1, name: 'Alice' },
              at: expect.any(Number) as unknown,
            },
          },
        },
      ],
    };
    expect(await alice.next()).toEqual(named);
    expect(await bob.next()).toEqual(named);
    expect(await bob.next()).toEqual({ t: 'refused', reason: 'Alice named this place first.' });
    await expectNothingPending(alice);
  });

  it('records a report of the words as they stood, once per reporter', async () => {
    const { alice, bob, db, site } = await atLandmark();
    alice.send(nameIt('Rude Word'));
    await nextOf(alice, 'traces');
    await nextOf(bob, 'traces');

    const report = { t: 'report', tx: site.tx, ty: site.ty, kind: 'landmark' };
    bob.send(report);
    bob.send(report);
    alice.send(report);
    alice.send(nameIt('Nice Word'));
    await nextOf(alice, 'traces');
    await nextOf(bob, 'traces');

    const rows = db.prepare('SELECT kind, reporter, snapshot FROM trace_reports').all() as {
      kind: string;
      reporter: number;
      snapshot: string;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'landmark', reporter: 2 });
    expect(JSON.parse(rows[0]!.snapshot)).toMatchObject({ named: { name: 'Rude Word' } });
  });

  it('shows names on the map until the namer or an admin clears them', async () => {
    const { alice, bob, base, db, coord, site } = await atLandmark();
    const cookie = await signup(base, 'carol');
    const onMap = { x: coord.sx * 20 + site.tx + 0.5, y: coord.sy * 15 + site.ty + 0.5 };
    alice.send(nameIt('Old Stones'));
    await nextOf(alice, 'traces');
    expect((await fetchMap(base, cookie)).names).toEqual([{ ...onMap, name: 'Old Stones' }]);

    alice.send({ t: 'act', action: { kind: 'landmark', input: { op: 'clear' } } });
    expect((await nextOf(alice, 'traces')).changes).toEqual([{ put: site }]);
    expect((await fetchMap(base, cookie)).names).toEqual([]);

    await nextOf(bob, 'traces');
    await nextOf(bob, 'traces');
    bob.send(nameIt('Bob Town'));
    await nextOf(bob, 'traces');
    expect(landmarkNames(db)).toMatchObject([{ coord, name: 'Bob Town', by: 'Bob' }]);
    expect(clearName(db, coord)).toBe('Bob Town');
    expect(landmarkNames(db)).toEqual([]);
    expect((await fetchMap(base, cookie)).names).toEqual([]);
  });
});

describe('sessions', () => {
  const TIMEOUT = 60_000;
  const EAST: ScreenCoord = { layer: OVERWORLD, sx: 1, sy: 0 };
  const STOOD: Pose = { x: 162, y: 202, dir: 'e', moving: false };

  function sessionsOn(db: WorldDb) {
    const clock = { t: 0 };
    const game = createGame(db, { now: () => clock.t, sessionTimeoutMs: TIMEOUT });
    const firstScreen = (user: User) => {
      const sent: ServerMessage[] = [];
      const player = game.connect(user, { send: (m) => sent.push(m), close: () => {} });
      const screen = sent.find((m) => m.t === 'screen')!;
      return { player, screen };
    };
    return { clock, game, firstScreen };
  }

  function setup() {
    const db = openWorldDatabase(':memory:');
    const alice = userNamed(1, 'alice');
    const games: Game[] = [];
    cleanups.push(() => {
      for (const game of games) game.stop();
      db.close();
    });
    const open = () => {
      const opened = sessionsOn(db);
      games.push(opened.game);
      return opened;
    };
    return { db, alice, open };
  }

  it('wakes a player in the garden once their last connection is a timeout old, wherever they were', () => {
    const { db, alice, open } = setup();
    savePlayerState(db, alice.id, { coord: EAST, pose: STOOD }, 0);
    const { clock, firstScreen } = open();
    clock.t = TIMEOUT;
    const { screen } = firstScreen(alice);
    expect(screen.arrival).toEqual({ kind: 'wake' });
    expect(screen.screen).toEqual(encodeScreen(secretGarden()));
    expect(screen.you).toEqual(SPAWN);
  });

  it('resumes the position without waking when the player reconnects within the timeout', () => {
    const { alice, open } = setup();
    const { clock, game, firstScreen } = open();
    const { player } = firstScreen(alice);
    game.receive(player, JSON.stringify({ t: 'move', ...STOOD }));
    clock.t = 5000;
    game.disconnect(player);

    clock.t = 5000 + TIMEOUT - 1;
    const again = firstScreen(alice);
    expect(again.screen.arrival).toEqual({ kind: 'none' });
    expect(again.screen.you).toEqual(STOOD);
  });

  it('keeps a connected player awake however long they idle, even across a crash', () => {
    const { alice, open } = setup();
    const first = open();
    const { player } = first.firstScreen(alice);
    first.game.receive(player, JSON.stringify({ t: 'move', ...STOOD }));
    first.clock.t = 1000;
    first.game.flush();
    first.clock.t = 3 * TIMEOUT;
    first.game.flush();

    const restarted = open();
    restarted.clock.t = 3 * TIMEOUT + 1000;
    const { screen } = restarted.firstScreen(alice);
    expect(screen.arrival).toEqual({ kind: 'none' });
    expect(screen.you).toEqual(STOOD);
  });
});

describe('game', () => {
  it('ignores messages from a connection that has been replaced', () => {
    const db = openWorldDatabase(':memory:');
    let clock = 0;
    const game = createGame(db, { now: () => (clock += 100) });
    cleanups.push(() => {
      game.stop();
      db.close();
    });
    const [alice, bob] = [userNamed(1, 'alice'), userNamed(2, 'bob')];
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

  it('saves every position when stopped, so the database can close before sockets do', () => {
    const db = openWorldDatabase(':memory:');
    let clock = 0;
    const game = createGame(db, { now: () => (clock += 100) });
    const alice = userNamed(1, 'alice');
    const player = game.connect(alice, { send: () => {}, close: () => {} });
    game.receive(player, JSON.stringify({ t: 'move', x: 162, y: 202, dir: 'e', moving: true }));

    game.stop();
    expect(loadPlayerState(db, alice.id)).toMatchObject({
      coord: GARDEN_COORD,
      pose: { x: 162, y: 202, dir: 'e', moving: false },
    });
    db.close();
    expect(() => game.disconnect(player)).not.toThrow();
  });
});

describe('worlds', () => {
  const BOB_WORLD = 2 as WorldId;

  it('lets a player into their own world only, closing a socket into another with a code', async () => {
    const { base } = await start(undefined, 'real');
    await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    const me = (await (
      await fetch(`http://${base}/api/me`, { headers: { cookie: bobCookie } })
    ).json()) as { user: { home: number } };
    expect(me.user.home).toBe(BOB_WORLD);

    const intruder = await connect(base, bobCookie, ALICE_WORLD);
    expect(await intruder.closed).toEqual({
      code: REFUSED_CLOSE_CODE,
      reason: 'That world is not open to you',
    });
    const map = await fetch(`http://${base}/api/worlds/${ALICE_WORLD}/map`, {
      headers: { cookie: bobCookie },
    });
    expect(map.status).toBe(403);
    expect(await map.json()).toMatchObject({ error: { code: 'forbidden' } });

    const bob = await connect(base, bobCookie, BOB_WORLD);
    expect((await nextOf(bob, 'screen')).others).toEqual([]);
    expect((await fetchMap(base, bobCookie, BOB_WORLD)).screens).toEqual([
      encodeScreen(secretGarden()),
    ]);
  });

  it('keeps players in different worlds apart: no presence, moves, traces, or screens cross', async () => {
    const { base, db, host } = await start(undefined, 'real');
    const aliceCookie = await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    saveInventory(db, 1, PROBES);
    const alice = await connect(base, aliceCookie);
    const bob = await connect(base, bobCookie, BOB_WORLD);
    expect((await nextOf(alice, 'screen')).others).toEqual([]);
    expect((await nextOf(bob, 'screen')).others).toEqual([]);

    walk(alice, SPAWN, [PROBE_STAND.x, PROBE_STAND.y]);
    alice.send({ t: 'use', slot: 0, ...PROBE_TILE });
    await nextOf(alice, 'traces');
    await nextOf(alice, 'inventory');
    walk(alice, PROBE_STAND, [SPAWN.x, SPAWN.y]);
    const arrival = await travelEast(alice);

    bob.send({ t: 'move', x: 0, y: 0, dir: 'n', moving: true });
    expect(await bob.next()).toEqual({ t: 'correct', x: SPAWN.x, y: SPAWN.y });
    const garden = encodeScreen(secretGarden());
    expect((await fetchMap(base, bobCookie, BOB_WORLD)).screens).toEqual([garden]);
    expect((await fetchMap(base, aliceCookie)).screens).toEqual([garden, arrival.screen]);
    expect(host.open(BOB_WORLD).db.prepare('SELECT count(*) AS n FROM traces').get()).toEqual({
      n: 0,
    });
    expect(loadWorld(host.open(BOB_WORLD).db).seed).not.toBe(loadWorld(db).seed);
  });
});

describe('visitors', () => {
  const BOB_WORLD = 2 as WorldId;
  const CODE = /^[A-HJKMNP-Z]{5}$/;

  const visitors = (base: string, cookie: string, method: string, worldId = ALICE_WORLD) =>
    fetch(`http://${base}/api/worlds/${worldId}/visitors`, { method, headers: { cookie } });

  async function openWorld(base: string, cookie: string, worldId = ALICE_WORLD): Promise<string> {
    const res = await visitors(base, cookie, 'POST', worldId);
    expect(res.status).toBe(200);
    const { code } = (await res.json()) as { code: string };
    expect(code).toMatch(CODE);
    return code;
  }

  const redeem = (base: string, cookie: string, code: string) =>
    fetch(`http://${base}/api/visits`, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });

  it('opens with a code a friend joins by; both see each other, in the garden and on the map', async () => {
    const { base } = await start(undefined, 'real');
    const aliceCookie = await signup(base, 'alice');
    const alice = await connect(base, aliceCookie);
    await nextOf(alice, 'screen');
    expect(await (await visitors(base, aliceCookie, 'GET')).json()).toEqual({ code: null });

    const code = await openWorld(base, aliceCookie);
    expect(await (await visitors(base, aliceCookie, 'GET')).json()).toEqual({ code });
    expect(await (await visitors(base, aliceCookie, 'POST')).json()).toEqual({ code });

    const bobCookie = await signup(base, 'bob');
    const early = await connect(base, bobCookie, ALICE_WORLD);
    expect((await early.closed).code).toBe(REFUSED_CLOSE_CODE);

    const redeemed = await redeem(base, bobCookie, ` ${code.toLowerCase()} `);
    expect(redeemed.status).toBe(200);
    expect(await redeemed.json()).toEqual({ world: { id: ALICE_WORLD, host: 'Alice' } });

    const bob = await connect(base, bobCookie, ALICE_WORLD);
    const arrival = await nextOf(bob, 'screen');
    expect(arrival).toMatchObject({
      arrival: { kind: 'visit' },
      screen: encodeScreen(secretGarden()),
      others: [{ id: 1, name: 'Alice', ...SPAWN }],
    });
    const garden = placeOf(secretGarden(), []);
    expect(canOccupy(garden, arrival.you.x, arrival.you.y)).toBe(true);
    if (arrival.arrival.kind !== 'visit') throw new Error('a visit arrives through a portal');
    expect(await alice.next()).toMatchObject({
      t: 'join',
      player: { id: 2, name: 'Bob' },
      portal: arrival.arrival.portal,
    });

    const bobsView = await fetchMap(base, bobCookie, ALICE_WORLD);
    expect(bobsView.players).toEqual([
      { id: 1, name: 'Alice', x: SPAWN.x / TILE, y: SPAWN.y / TILE, you: false },
      { id: 2, name: 'Bob', x: arrival.you.x / TILE, y: arrival.you.y / TILE, you: true },
    ]);
    const alicesView = await fetchMap(base, aliceCookie);
    expect(alicesView.players.map((p) => [p.name, p.you])).toEqual([
      ['Alice', true],
      ['Bob', false],
    ]);
    expect((await fetchMap(base, bobCookie, BOB_WORLD)).players).toEqual([]);
  });

  it('refuses a wrong code and a code from before a close with a friendly message', async () => {
    const { base } = await start(undefined, 'real');
    const aliceCookie = await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    const unknown = await redeem(base, bobCookie, 'ABCDE');
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toEqual({
      error: {
        code: 'unknown_code',
        message: "That code doesn't open any world right now. Check it with your friend.",
      },
    });
    const malformed = await redeem(base, bobCookie, 'AB1');
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({
      error: {
        code: 'validation',
        message: 'A code is 5 letters. Check it with your friend.',
        field: 'code',
      },
    });

    const first = await openWorld(base, aliceCookie);
    expect((await visitors(base, aliceCookie, 'DELETE')).status).toBe(204);
    expect((await redeem(base, bobCookie, first)).status).toBe(404);
    const second = await openWorld(base, aliceCookie);
    expect(second).not.toBe(first);
    expect((await redeem(base, bobCookie, first)).status).toBe(404);
    expect((await redeem(base, bobCookie, second)).status).toBe(200);
  });

  it('closing sends every visitor home at once with the reason, and the world shuts behind them', async () => {
    const { base } = await start(undefined, 'real');
    const aliceCookie = await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    const carolCookie = await signup(base, 'carol');
    const alice = await connect(base, aliceCookie);
    await nextOf(alice, 'screen');
    const code = await openWorld(base, aliceCookie);
    for (const cookie of [bobCookie, carolCookie])
      expect((await redeem(base, cookie, code)).status).toBe(200);
    const bob = await connect(base, bobCookie, ALICE_WORLD);
    await nextOf(bob, 'screen');
    const carol = await connect(base, carolCookie, ALICE_WORLD);
    await nextOf(carol, 'screen');
    await nextOf(alice, 'join');
    await nextOf(alice, 'join');
    await nextOf(bob, 'join');

    expect((await visitors(base, aliceCookie, 'DELETE')).status).toBe(204);
    const reason = "Alice closed their world, so you're back home.";
    const bobGoes = await bob.next();
    const carolGoes = await carol.next();
    expect(bobGoes).toMatchObject({ t: 'depart', reason });
    expect(carolGoes).toMatchObject({ t: 'depart', reason });
    expect((await bob.closed).code).toBe(DEPARTED_CLOSE_CODE);
    expect((await carol.closed).code).toBe(DEPARTED_CLOSE_CODE);
    const portalOf = (m: ServerMessage) => (m.t === 'depart' ? m.portal : undefined);
    expect(await nextOf(alice, 'leave')).toEqual({ t: 'leave', id: 2, portal: portalOf(bobGoes) });
    expect(await nextOf(alice, 'leave')).toEqual({
      t: 'leave',
      id: 3,
      portal: portalOf(carolGoes),
    });
    expect(await (await visitors(base, aliceCookie, 'GET')).json()).toEqual({ code: null });

    const again = await connect(base, bobCookie, ALICE_WORLD);
    expect((await again.closed).code).toBe(REFUSED_CLOSE_CODE);
    expect(
      (await fetch(`http://${base}/api/worlds/1/map`, { headers: { cookie: bobCookie } })).status,
    ).toBe(403);
    await expectNothingPending(alice);
  });

  it('a visitor who goes home leaves through a portal the host sees; the host cannot', async () => {
    const { base } = await start(undefined, 'real');
    const aliceCookie = await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    const alice = await connect(base, aliceCookie);
    await nextOf(alice, 'screen');
    expect((await redeem(base, bobCookie, await openWorld(base, aliceCookie))).status).toBe(200);
    const bob = await connect(base, bobCookie, ALICE_WORLD);
    const { you } = await nextOf(bob, 'screen');
    await nextOf(alice, 'join');

    alice.send({ t: 'goHome' });
    bob.send({ t: 'goHome' });
    const goes = await bob.next();
    if (goes.t !== 'depart') throw new Error(`expected depart, got ${goes.t}`);
    expect(goes).toEqual({ t: 'depart', portal: goes.portal });
    expect(goes.portal).toEqual({ tx: Math.floor(you.x / TILE), ty: Math.floor(you.y / TILE) - 1 });
    expect((await bob.closed).code).toBe(DEPARTED_CLOSE_CODE);
    expect(await alice.next()).toEqual({ t: 'leave', id: 2, portal: goes.portal });
    expect(await (await visitors(base, aliceCookie, 'GET')).json()).not.toEqual({ code: null });
    await expectNothingPending(alice);
  });

  it('a visitor who reconnects comes and goes with no portal', async () => {
    const { base } = await start(undefined, 'real');
    const aliceCookie = await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    const alice = await connect(base, aliceCookie);
    await nextOf(alice, 'screen');
    expect((await redeem(base, bobCookie, await openWorld(base, aliceCookie))).status).toBe(200);
    const bob = await connect(base, bobCookie, ALICE_WORLD);
    await nextOf(bob, 'screen');
    await nextOf(alice, 'join');

    await bob.close();
    expect(await nextOf(alice, 'leave')).toEqual({ t: 'leave', id: 2 });
    const again = await connect(base, bobCookie, ALICE_WORLD);
    expect(await nextOf(again, 'screen')).toMatchObject({ arrival: { kind: 'none' } });
    const joined = await nextOf(alice, 'join');
    expect(joined).not.toHaveProperty('portal');
  });

  it('logging out sends visitors home', async () => {
    const { base } = await start(undefined, 'real');
    const aliceCookie = await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    const alice = await connect(base, aliceCookie);
    await nextOf(alice, 'screen');
    expect((await redeem(base, bobCookie, await openWorld(base, aliceCookie))).status).toBe(200);
    const bob = await connect(base, bobCookie, ALICE_WORLD);
    await nextOf(bob, 'screen');

    const out = await fetch(`http://${base}/api/logout`, {
      method: 'POST',
      headers: { cookie: aliceCookie },
    });
    expect(out.status).toBe(204);
    expect(await bob.next()).toMatchObject({ t: 'depart' });
    expect((await bob.closed).code).toBe(DEPARTED_CLOSE_CODE);
  });

  it('going to visit a friend closes your own world to visitors', async () => {
    const { base } = await start(undefined, 'real');
    const aliceCookie = await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    const carolCookie = await signup(base, 'carol');
    const alice = await connect(base, aliceCookie);
    await nextOf(alice, 'screen');
    const bobHome = await connect(base, bobCookie, BOB_WORLD);
    await nextOf(bobHome, 'screen');
    const bobsCode = await openWorld(base, bobCookie, BOB_WORLD);
    expect((await redeem(base, carolCookie, bobsCode)).status).toBe(200);
    const carol = await connect(base, carolCookie, BOB_WORLD);
    await nextOf(carol, 'screen');
    await nextOf(bobHome, 'join');

    expect((await redeem(base, bobCookie, await openWorld(base, aliceCookie))).status).toBe(200);
    const bobAway = await connect(base, bobCookie, ALICE_WORLD);
    await nextOf(bobAway, 'screen');
    expect(await carol.next()).toMatchObject({
      t: 'depart',
      reason: "Bob closed their world, so you're back home.",
    });
    expect(await (await visitors(base, bobCookie, 'GET', BOB_WORLD)).json()).toEqual({
      code: null,
    });
  });

  it("keeps what a visitor does in the host's world there; their own world is unchanged", async () => {
    const { base, db, host } = await start(undefined, 'real');
    const aliceCookie = await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    const alice = await connect(base, aliceCookie);
    await nextOf(alice, 'screen');
    saveInventory(db, 2, PROBES);
    // Bob stood here on an earlier walk this session, so he resumes beside the probe tile.
    const stood: Pose = { ...PROBE_STAND, dir: 'e', moving: false };
    savePlayerState(db, 2, { coord: GARDEN_COORD, pose: stood }, 0);
    expect((await redeem(base, bobCookie, await openWorld(base, aliceCookie))).status).toBe(200);

    const bob = await connect(base, bobCookie, ALICE_WORLD);
    const arrival = await nextOf(bob, 'screen');
    expect(arrival).toMatchObject({
      arrival: { kind: 'none' },
      you: stood,
      inventory: [...PROBES],
    });
    bob.send({ t: 'use', slot: 0, ...PROBE_TILE });
    expect(await nextOf(bob, 'traces')).toMatchObject({ t: 'traces' });
    await nextOf(bob, 'inventory');
    walk(bob, stood, [200, 120], [316, 120]);
    bob.send({ t: 'travel', dir: 'e' });
    const east = await nextOf(bob, 'screen');
    expect(east.screen).toMatchObject({ sx: 1, sy: 0 });
    await bob.close();

    expect(loadPlayerState(db, 2)).toMatchObject({ coord: { sx: 1, sy: 0 } });
    expect(loadInventory(db, 2)).toEqual([
      ...parseInventory([{ kind: 'probe', variant: 'probe', count: 1 }]),
    ]);
    expect(db.prepare('SELECT count(*) AS n FROM traces').get()).toEqual({ n: 1 });
    expect((await fetchMap(base, aliceCookie)).screens).toEqual([
      encodeScreen(secretGarden()),
      east.screen,
    ]);
    const home = host.open(BOB_WORLD).db;
    expect(loadPlayerState(home, 2)).toBeUndefined();
    expect(loadInventory(home, 2)).toEqual([]);
    expect(home.prepare('SELECT count(*) AS n FROM traces').get()).toEqual({ n: 0 });
    expect((await fetchMap(base, bobCookie, BOB_WORLD)).screens).toEqual([]);
  });

  it('lets only the owner open, read, or close a world, and only when logged in', async () => {
    const { base } = await start(undefined, 'real');
    const aliceCookie = await signup(base, 'alice');
    const bobCookie = await signup(base, 'bob');
    expect((await redeem(base, bobCookie, await openWorld(base, aliceCookie))).status).toBe(200);
    for (const method of ['GET', 'POST', 'DELETE']) {
      const res = await visitors(base, bobCookie, method);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: { code: 'forbidden' } });
      expect((await visitors(base, 'session=nope', method)).status).toBe(401);
    }
    expect((await fetch(`http://${base}/api/visits`, { method: 'POST' })).status).toBe(401);
    expect((await visitors(base, aliceCookie, 'GET')).status).toBe(200);
  });
});
