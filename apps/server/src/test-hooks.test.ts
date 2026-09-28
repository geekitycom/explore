import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OVERWORLD, TILE, type ServerMessage } from '@explore/core';
import { afterEach, expect, it } from 'vitest';
import { createWorldHost } from './host.ts';
import { loadInventory } from './inventory.ts';
import { AUTH_LIMITS, createRateLimits } from './rate-limit.ts';
import { testHookRoutes, type TestHookBody, type TestHookName } from './test-hooks.ts';
import { userNamed } from './testing.ts';
import { loadPlayerState } from './world.ts';
import type { WorldId } from './worlds.ts';

const ONE = 1 as WorldId;
const ALICE = userNamed(1, 'Alice');
const STONES = [{ kind: 'rock', variant: 'granite', count: 2 }] as const;
const EAST = { layer: OVERWORLD, sx: 1, sy: 0 };

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'explore-hooks-'));
  const rateLimits = createRateLimits();
  const host = createWorldHost({ pathOf: (id) => join(dir, `${id}.db`) });
  cleanups.push(() => {
    host.stop();
    rmSync(dir, { recursive: true, force: true });
  });
  const routes = testHookRoutes({ host, rateLimits });
  const call = <K extends TestHookName>(name: K, body: TestHookBody<K>) =>
    routes.request(`/${name}`, { method: 'POST', body: JSON.stringify(body) });
  const sent: ServerMessage[] = [];
  const connect = () =>
    host.connect(ONE, ALICE, { send: (m) => sent.push(m), close: () => {} }, 'owner');
  return { host, rateLimits, call, sent, connect };
}

it('gives a connected player items that a later disconnect keeps', async () => {
  const { host, call, sent, connect } = setup();
  const player = connect();

  const res = await call('inventory', { worldId: ONE, userId: ALICE.id, stacks: [...STONES] });

  expect(res.status).toBe(204);
  expect(sent.at(-1)).toEqual({ t: 'inventory', stacks: [...STONES] });
  host.disconnect(ONE, player);
  expect(loadInventory(host.open(ONE).db, ALICE.id)).toEqual([...STONES]);
});

it('moves a connected player at once, and their disconnect saves them where they were put', async () => {
  const { host, call, sent, connect } = setup();
  const player = connect();

  await call('place', { worldId: ONE, userId: ALICE.id, coord: EAST, tile: { tx: 3, ty: 4 } });

  const pose = { x: 3.5 * TILE, y: 5 * TILE - 2, dir: 'n', moving: false };
  const screen = sent.at(-1);
  expect(screen).toMatchObject({ t: 'screen', you: pose, screen: EAST });
  host.disconnect(ONE, player);
  expect(loadPlayerState(host.open(ONE).db, ALICE.id)).toMatchObject({ coord: EAST, pose });
});

it('places a player who is away, for their next connection to resume', async () => {
  const { host, call } = setup();
  host.open(ONE);

  await call('place', { worldId: ONE, userId: ALICE.id, coord: EAST, tile: { tx: 3, ty: 4 } });

  expect(loadPlayerState(host.open(ONE).db, ALICE.id)?.coord).toEqual(EAST);
});

it('clears every rate limit', async () => {
  const { rateLimits, call } = setup();
  const limiter = rateLimits.limiter(AUTH_LIMITS.loginsPerAddress);
  for (let i = 0; i < AUTH_LIMITS.loginsPerAddress.max; i++) limiter.hit('here');
  expect(limiter.retryAfterMs('here')).toBeGreaterThan(0);

  await call('rate-limits', {});
  expect(limiter.retryAfterMs('here')).toBe(0);
});

it('rejects an unknown hook and a body that does not parse', async () => {
  const { call } = setup();
  const invalid = await call('place', {
    worldId: ONE,
    userId: -1,
    coord: EAST,
    tile: { tx: 0, ty: 0 },
  });
  expect(invalid.status).toBe(400);
  const unknown = await call('nope' as TestHookName, {});
  expect(unknown.status).toBe(404);
});
