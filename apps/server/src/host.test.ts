import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GARDEN_COORD,
  GARDEN_SPAWN,
  DEPARTED_CLOSE_CODE,
  boxTiles,
  parseInventory,
  type ServerMessage,
} from '@explore/core';
import { afterEach, expect, test, vi } from 'vitest';
import { createWorldHost } from './host.ts';
import { loadInventory, saveInventory } from './inventory.ts';
import type { Conn } from './presence.ts';
import { userNamed } from './testing.ts';
import { loadPlayerState } from './world.ts';
import type { Admission, WorldId } from './worlds.ts';

const ONE = 1 as WorldId;
const TWO = 2 as WorldId;
const IDLE_MS = 1000;
/** Longer than the idle close, so a world with a host away can close on its own first. */
const TIMEOUT = 10_000;
const STOOD = { x: 162, y: 202, dir: 'e', moving: false } as const;
const SPAWN = { ...GARDEN_SPAWN, moving: false };
const PROBES = parseInventory([{ kind: 'probe', variant: 'probe', count: 2 }]);

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'explore-host-'));
  const clock = { t: 0 };
  const host = createWorldHost({
    pathOf: (id) => join(dir, `${id}.db`),
    game: { now: () => clock.t, sessionTimeoutMs: TIMEOUT },
    idleMs: IDLE_MS,
    now: () => clock.t,
  });
  cleanups.push(() => {
    host.stop();
    rmSync(dir, { recursive: true, force: true });
  });
  const inbox = (sent: ServerMessage[], closes: number[]): Conn => ({
    send: (message) => sent.push(message),
    close: (code) => closes.push(code),
  });
  const join_ = (world: WorldId, id: number, name: string, role: Admission = 'owner') => {
    const sent: ServerMessage[] = [];
    const closes: number[] = [];
    const player = host.connect(world, userNamed(id, name), inbox(sent, closes), role);
    return { player, sent, closes, user: userNamed(id, name) };
  };
  /** Alice opens ONE and Bob comes in with the code. */
  const hostAndGuest = () => {
    const alice = join_(ONE, 1, 'alice');
    const code = host.openToVisitors(ONE, alice.user);
    expect(host.redeemCode(code, 2)).toEqual({ id: ONE, host: 'alice' });
    const bob = join_(ONE, 2, 'bob', 'visitor');
    return { alice, bob, code };
  };
  return { dir, clock, host, join: join_, hostAndGuest };
}

const departs = (sent: ServerMessage[]) => sent.filter((m) => m.t === 'depart');
const screens = (sent: ServerMessage[]) => sent.filter((m) => m.t === 'screen');

test('opens a world when first entered and closes it once nobody has been in it for a while', () => {
  const { dir, clock, host, join } = setup();
  expect(host.openIds()).toEqual([]);
  const alice = join(ONE, 1, 'alice');
  const bob = join(TWO, 2, 'bob');
  expect(host.openIds()).toEqual([ONE, TWO]);
  expect(
    readdirSync(dir)
      .filter((f) => f.endsWith('.db'))
      .sort(),
  ).toEqual(['1.db', '2.db']);
  expect(alice.sent[0]).toMatchObject({ t: 'screen', others: [] });
  expect(bob.sent[0]).toMatchObject({ t: 'screen', others: [] });

  host.receive(ONE, alice.player, JSON.stringify({ t: 'move', ...STOOD, moving: true }));
  clock.t = 100;
  host.disconnect(ONE, alice.player);
  clock.t = 100 + IDLE_MS - 1;
  host.sweep();
  expect(host.openIds()).toEqual([ONE, TWO]);
  clock.t = 100 + IDLE_MS;
  host.sweep();
  expect(host.openIds()).toEqual([TWO]);

  const again = join(ONE, 1, 'alice');
  expect(host.openIds()).toEqual([TWO, ONE]);
  expect(again.sent[0]).toMatchObject({ t: 'screen', you: STOOD, arrival: { kind: 'none' } });
  expect(loadPlayerState(host.open(ONE).db, 1)).toMatchObject({
    coord: GARDEN_COORD,
    pose: STOOD,
  });
});

test('flushes every open world, so each keeps its own players awake', () => {
  const { clock, host, join } = setup();
  const alice = join(ONE, 1, 'alice');
  const bob = join(TWO, 2, 'bob');
  host.receive(ONE, alice.player, JSON.stringify({ t: 'move', ...STOOD, moving: true }));
  host.receive(
    TWO,
    bob.player,
    JSON.stringify({ t: 'move', x: 162, y: 202, dir: 'w', moving: true }),
  );
  clock.t = 5000;
  host.flush();
  expect(loadPlayerState(host.open(ONE).db, 1)).toMatchObject({ pose: STOOD, seenAt: 5000 });
  expect(loadPlayerState(host.open(TWO).db, 2)).toMatchObject({
    pose: { x: 162, y: 202, dir: 'w', moving: false },
    seenAt: 5000,
  });
  expect(loadPlayerState(host.open(ONE).db, 2)).toBeUndefined();
});

async function holdWriteLock(path: string, ms: number) {
  const child = spawn(
    process.execPath,
    [
      '-e',
      `const { DatabaseSync } = require('node:sqlite');
       const db = new DatabaseSync(${JSON.stringify(path)});
       db.exec('BEGIN IMMEDIATE');
       console.log('locked');
       Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${ms});
       db.exec('COMMIT');`,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] },
  );
  const exited = once(child, 'exit');
  await once(child.stdout, 'data');
  return { exited };
}

test('a save waits for another process holding the world file, instead of failing', async () => {
  const { dir, clock, host, join: enter } = setup();
  const alice = enter(ONE, 1, 'alice');
  host.receive(ONE, alice.player, JSON.stringify({ t: 'move', ...STOOD, moving: true }));
  const { exited } = await holdWriteLock(join(dir, '1.db'), 300);
  clock.t = 5000;
  host.flush();
  await exited;
  expect(loadPlayerState(host.open(ONE).db, 1)).toMatchObject({ pose: STOOD, seenAt: 5000 });
});

test('a world that fails to save is logged and leaves the other worlds saving and closing', () => {
  const { clock, host, join } = setup();
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  cleanups.push(() => errors.mockRestore());
  join(ONE, 1, 'alice');
  const bob = join(TWO, 2, 'bob');
  host.receive(TWO, bob.player, JSON.stringify({ t: 'move', ...STOOD, moving: true }));
  host.open(ONE).db.exec('PRAGMA query_only = ON');

  clock.t = 5000;
  expect(() => host.flush()).not.toThrow();
  expect(loadPlayerState(host.open(TWO).db, 2)).toMatchObject({ pose: STOOD, seenAt: 5000 });
  expect(errors).toHaveBeenCalledWith(expect.stringContaining('world 1'), expect.any(Error));

  expect(() => host.stop()).not.toThrow();
  expect(host.openIds()).toEqual([]);
});

test('drops what a stale socket sends for a world that has since closed', () => {
  const { clock, host, join } = setup();
  const alice = join(ONE, 1, 'alice');
  host.disconnect(ONE, alice.player);
  clock.t = IDLE_MS;
  host.sweep();
  expect(host.openIds()).toEqual([]);

  host.receive(ONE, alice.player, JSON.stringify({ t: 'move', ...STOOD, moving: true }));
  host.disconnect(ONE, alice.player);
  expect(host.openIds()).toEqual([]);
});

test('tells whichever world the player is in about a new name and avatar', () => {
  const { host, join } = setup();
  const alice = join(ONE, 1, 'alice');
  const bob = join(ONE, 2, 'bob');
  const carol = join(TWO, 3, 'carol');
  bob.sent.length = 0;
  carol.sent.length = 0;
  const restyled = { ...userNamed(1, 'Ali'), avatarChosen: true };
  host.changeProfile(restyled);
  expect(bob.sent).toEqual([{ t: 'profile', id: 1, name: 'Ali', avatar: restyled.avatar }]);
  expect(carol.sent).toEqual([]);
  expect(alice.sent.filter((m) => m.t === 'profile')).toEqual([]);
});

test('a visitor arrives fresh on a free garden tile, the host wakes at the spawn', () => {
  const { host, hostAndGuest } = setup();
  const { alice, bob } = hostAndGuest();
  expect(alice.sent[0]).toMatchObject({ t: 'screen', you: SPAWN, arrival: { kind: 'wake' } });
  const arrival = screens(bob.sent)[0]!;
  expect(arrival).toMatchObject({
    t: 'screen',
    arrival: { kind: 'visit' },
    others: [{ id: 1, ...SPAWN }],
  });
  if (arrival.t !== 'screen') throw new Error('unreachable');
  const aliceTiles = boxTiles(SPAWN.x, SPAWN.y).map((t) => `${t.tx},${t.ty}`);
  const bobTiles = boxTiles(arrival.you.x, arrival.you.y).map((t) => `${t.tx},${t.ty}`);
  expect(bobTiles.filter((t) => aliceTiles.includes(t))).toEqual([]);
  expect(host.opening(ONE)).toMatchObject({ state: 'open', host: { id: 1, name: 'alice' } });
  expect(host.admits(ONE, 2)).toBe(true);
});

test('closing the world sends every visitor home once, with the reason, and closes their sockets', () => {
  const { host, join, hostAndGuest } = setup();
  const { alice, bob, code } = hostAndGuest();
  host.redeemCode(code, 3);
  const carol = join(ONE, 3, 'carol', 'visitor');

  host.closeToVisitors(ONE);
  host.closeToVisitors(ONE);
  const reason = "alice closed their world, so you're back home.";
  const [bobGoes] = departs(bob.sent);
  const [carolGoes] = departs(carol.sent);
  expect(departs(bob.sent)).toMatchObject([{ t: 'depart', reason }]);
  expect(departs(carol.sent)).toMatchObject([{ t: 'depart', reason }]);
  expect(bob.closes).toEqual([DEPARTED_CLOSE_CODE]);
  expect(carol.closes).toEqual([DEPARTED_CLOSE_CODE]);
  expect(departs(alice.sent)).toEqual([]);
  expect(alice.closes).toEqual([]);
  const portalOf = (m: ServerMessage | undefined) => (m?.t === 'depart' ? m.portal : undefined);
  expect(portalOf(bobGoes)).not.toEqual(portalOf(carolGoes));
  expect(alice.sent.filter((m) => m.t === 'leave')).toEqual([
    { t: 'leave', id: 2, portal: portalOf(bobGoes) },
    { t: 'leave', id: 3, portal: portalOf(carolGoes) },
  ]);
  expect(host.open(ONE).game.playerCount()).toBe(1);
  expect(host.opening(ONE)).toEqual({ state: 'closed' });
  expect(host.admits(ONE, 2)).toBe(false);
  expect(host.redeemCode(code, 4)).toBeUndefined();
});

test('the sweep closes the world to visitors once its host has been gone for the session timeout', () => {
  const { clock, host, join, hostAndGuest } = setup();
  const { alice, bob } = hostAndGuest();
  clock.t = 100;
  host.disconnect(ONE, alice.player);

  clock.t = 100 + TIMEOUT - 1;
  host.flush();
  host.sweep();
  expect(host.opening(ONE).state).toBe('open');
  expect(departs(bob.sent)).toEqual([]);

  const back = join(ONE, 1, 'alice');
  expect(back.sent[0]).toMatchObject({ t: 'screen', arrival: { kind: 'none' } });
  clock.t = 200 + TIMEOUT;
  host.disconnect(ONE, back.player);
  clock.t = 200 + 2 * TIMEOUT - 1;
  host.sweep();
  expect(host.opening(ONE).state).toBe('open');

  clock.t = 200 + 2 * TIMEOUT;
  host.sweep();
  expect(host.opening(ONE)).toEqual({ state: 'closed' });
  expect(departs(bob.sent)).toHaveLength(1);
  expect(bob.closes).toEqual([DEPARTED_CLOSE_CODE]);
  expect(host.open(ONE).game.playerCount()).toBe(0);
});

test('a host who stays connected keeps the world open however long they idle', () => {
  const { clock, host, hostAndGuest } = setup();
  const { bob } = hostAndGuest();
  for (let i = 1; i <= 5; i++) {
    clock.t = i * TIMEOUT;
    host.flush();
    host.sweep();
  }
  expect(host.opening(ONE).state).toBe('open');
  expect(departs(bob.sent)).toEqual([]);
});

test('going to visit another world closes your own to visitors', () => {
  const { host, join, hostAndGuest } = setup();
  const { alice, bob } = hostAndGuest();
  const carol = join(TWO, 3, 'carol');
  const code = host.openToVisitors(TWO, carol.user);
  host.redeemCode(code, 1);
  bob.sent.length = 0;

  join(TWO, 1, 'alice', 'visitor');
  expect(departs(bob.sent)).toHaveLength(1);
  expect(host.opening(ONE)).toEqual({ state: 'closed' });
  expect(host.opening(TWO).state).toBe('open');
  expect(alice.closes).toEqual([]);
});

test('a world that closes for being empty also stops taking visitors', () => {
  const { clock, host, hostAndGuest } = setup();
  const { alice, bob, code } = hostAndGuest();
  host.disconnect(ONE, bob.player);
  host.disconnect(ONE, alice.player);
  clock.t = IDLE_MS;
  host.sweep();
  expect(host.openIds()).toEqual([]);
  expect(host.opening(ONE)).toEqual({ state: 'closed' });
  expect(host.redeemCode(code, 3)).toBeUndefined();
});

test("a visitor's position and items live in the host's world file, and their home is untouched", () => {
  const { host, hostAndGuest } = setup();
  saveInventory(host.open(ONE).db, 2, PROBES);
  const { bob } = hostAndGuest();
  const arrival = screens(bob.sent)[0]!;
  expect(arrival).toMatchObject({ inventory: [...PROBES] });
  if (arrival.t !== 'screen') throw new Error('unreachable');
  const step = { x: arrival.you.x + 2, y: arrival.you.y, dir: 'e', moving: false };
  host.receive(ONE, bob.player, JSON.stringify({ t: 'move', ...step, moving: true }));
  host.disconnect(ONE, bob.player);

  expect(loadPlayerState(host.open(ONE).db, 2)).toMatchObject({ coord: GARDEN_COORD, pose: step });
  expect(loadInventory(host.open(ONE).db, 2)).toEqual([...PROBES]);
  expect(loadPlayerState(host.open(TWO).db, 2)).toBeUndefined();
  expect(loadInventory(host.open(TWO).db, 2)).toEqual([]);
});

test('a visit and the walk home are one session: home resumes in place, with no wake-up', () => {
  const { clock, host, join, hostAndGuest } = setup();
  const bobHome = join(TWO, 2, 'bob');
  host.receive(TWO, bobHome.player, JSON.stringify({ t: 'move', ...STOOD, moving: true }));
  clock.t = 100;
  host.disconnect(TWO, bobHome.player);

  clock.t = 200;
  const { bob } = hostAndGuest();
  for (let i = 1; i <= 4; i++) {
    clock.t = 200 + (i * TIMEOUT) / 2;
    host.flush();
  }
  host.disconnect(ONE, bob.player);

  clock.t += 100;
  const home = join(TWO, 2, 'bob');
  expect(home.sent[0]).toMatchObject({ t: 'screen', you: STOOD, arrival: { kind: 'none' } });
});

test('a real gap wakes you at home, even after playing elsewhere, and never resumes a stale visit', () => {
  const { clock, host, join, hostAndGuest } = setup();
  const { alice, bob } = hostAndGuest();
  host.receive(ONE, bob.player, JSON.stringify({ t: 'move', ...STOOD, moving: true }));
  clock.t = 100;
  host.disconnect(ONE, bob.player);
  host.disconnect(ONE, alice.player);

  clock.t = 100 + 2 * TIMEOUT;
  const home = join(TWO, 2, 'bob');
  expect(home.sent[0]).toMatchObject({ t: 'screen', you: SPAWN, arrival: { kind: 'wake' } });
  clock.t += 100;
  host.disconnect(TWO, home.player);

  clock.t += 100;
  const hostAgain = join(ONE, 1, 'alice');
  host.redeemCode(host.openToVisitors(ONE, hostAgain.user), 2);
  const again = join(ONE, 2, 'bob', 'visitor');
  const arrival = screens(again.sent)[0]!;
  expect(arrival).toMatchObject({ t: 'screen', arrival: { kind: 'visit' } });
  if (arrival.t === 'screen') expect(arrival.you).not.toEqual(STOOD);
});
