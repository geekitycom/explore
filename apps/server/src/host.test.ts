import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GARDEN_COORD, type ServerMessage } from '@explore/core';
import { afterEach, expect, test } from 'vitest';
import { createWorldHost } from './host.ts';
import type { Conn } from './presence.ts';
import { userNamed } from './testing.ts';
import { loadPlayerState } from './world.ts';
import type { WorldId } from './worlds.ts';

const ONE = 1 as WorldId;
const TWO = 2 as WorldId;
const IDLE_MS = 1000;
const STOOD = { x: 162, y: 202, dir: 'e', moving: false } as const;

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'explore-host-'));
  const clock = { t: 0 };
  const host = createWorldHost({
    pathOf: (id) => join(dir, `${id}.db`),
    game: { now: () => clock.t },
    idleMs: IDLE_MS,
    now: () => clock.t,
  });
  cleanups.push(() => {
    host.stop();
    rmSync(dir, { recursive: true, force: true });
  });
  const inbox = (sent: ServerMessage[]): Conn => ({
    send: (message) => sent.push(message),
    close: () => {},
  });
  const join_ = (world: WorldId, id: number, name: string) => {
    const sent: ServerMessage[] = [];
    const player = host.connect(world, userNamed(id, name), inbox(sent));
    return { player, sent };
  };
  return { dir, clock, host, join: join_ };
}

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
  expect(again.sent[0]).toMatchObject({ t: 'screen', you: STOOD, wake: false });
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

test('tells whichever world the player is in about a new avatar', () => {
  const { host, join } = setup();
  const alice = join(ONE, 1, 'alice');
  const bob = join(ONE, 2, 'bob');
  const carol = join(TWO, 3, 'carol');
  bob.sent.length = 0;
  carol.sent.length = 0;
  const restyled = { ...userNamed(1, 'alice'), avatarChosen: true };
  host.changeAvatar(restyled);
  expect(bob.sent).toEqual([{ t: 'avatar', id: 1, avatar: restyled.avatar }]);
  expect(carol.sent).toEqual([]);
  expect(alice.sent.filter((m) => m.t === 'avatar')).toEqual([]);
});
