import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  DEFAULT_AVATAR,
  EPITAPH_MAX,
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  networkOf,
  seedEpitaph,
  type ScreenCoord,
  type ServerMessage,
  type Trace,
} from '@explore/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from './db.ts';
import { cleanEpitaph, listEpitaphs, setEpitaph, type WriteText } from './epitaphs.ts';
import { createGame } from './play.ts';
import type { TextRequest, TextResult } from './text-gen.ts';
import type { Player } from './presence.ts';
import { insertUser, rowToUser, type UserRow } from './users.ts';
import { getScreen, loadWorld, savePlayerState } from './world.ts';

describe('cleanEpitaph', () => {
  it.each([
    ['"Here lies Ada, gone fishing."', 'Here lies Ada, gone fishing.'],
    ['Epitaph: **Rest well, Otto.**\nHope you like it!', 'Rest well, Otto.'],
    ['  \n  Fern   loved\tthe rain  ', 'Fern loved the rain'],
    ["'Moss knew the way home'", 'Moss knew the way home'],
    ["Nature's quiet keeper", "Nature's quiet keeper"],
  ])('keeps the carved words of %j', (raw, words) => {
    expect(cleanEpitaph(raw)).toBe(words);
  });

  it.each([
    ['', 'nothing'],
    ['x'.repeat(EPITAPH_MAX + 1), 'too long'],
    ['Here lies a shitty poet', 'a blocked word'],
    ['As an AI, I cannot write epitaphs.', 'a refusal'],
    ['<b>Rest</b>', 'markup'],
  ])('drops %j (%s)', (raw) => {
    expect(cleanEpitaph(raw)).toBeUndefined();
  });
});

const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

function tempDb(): string {
  const dir = mkdtempSync(join(tmpdir(), 'explore-epitaphs-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, 'explore.db');
}

/** The screen holding the centre of the nearest graveyard to the garden. */
function graveyardScreen(db: DatabaseSync): ScreenCoord {
  const poi = networkOf(loadWorld(db), OVERWORLD)
    .poisIn({ x0: -800, y0: -600, x1: 800, y1: 600 })
    .filter((p) => p.kind === 'graveyard' || p.kind === 'burialground')
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0]!;
  return { layer: OVERWORLD, sx: Math.floor(poi.x / SCREEN_W), sy: Math.floor(poi.y / SCREEN_H) };
}

/** A language model the test answers by hand, one grave at a time. */
function fakeModel() {
  const asked: { request: TextRequest; answer: (result: TextResult) => void }[] = [];
  const writeText: WriteText = (request) =>
    new Promise((answer) => asked.push({ request, answer }));
  const nameIn = (request: TextRequest) =>
    /epitaph for (\w+),/.exec(request.messages.at(-1)!.content)![1]!;
  return { asked, writeText, nameIn };
}

type Inbox = ServerMessage[];

function open(path: string, writeText?: WriteText) {
  const db = openDatabase(path);
  let clock = 0;
  const game = createGame(db, { now: () => (clock += 100), writeText });
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
    const user = rowToUser(
      db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(userId) as UserRow,
    );
    const player = game.connect(user, { send: (m) => inbox.push(m), close: () => {} });
    players.set(userId, player);
    return inbox;
  };
  const leave = (userId: number) => game.disconnect(players.get(userId)!);
  return { db, game, stop, join, leave };
}

/** A database whose two players, alice (1) and bob (2), stand on a graveyard's screen. */
function atGraveyard(path: string) {
  const db = openDatabase(path);
  for (const username of ['alice', 'bob'])
    insertUser(db, { username, passwordHash: 'x', avatar: DEFAULT_AVATAR });
  const coord = graveyardScreen(db);
  for (const id of [1, 2])
    savePlayerState(db, id, { coord, pose: { x: 4, y: 4, dir: 's', moving: false } });
  db.close();
  return coord;
}

const epitaphsIn = (traces: readonly Trace[]) =>
  traces.flatMap((t) => (t.kind === 'epitaph' ? [t] : []));
const screenOf = (inbox: Inbox) => {
  const screen = inbox.find((m) => m.t === 'screen');
  if (screen?.t !== 'screen') throw new Error('no screen sent');
  return screen;
};
const writtenIn = (inbox: Inbox) =>
  inbox.flatMap((m) =>
    m.t === 'traces' ? m.changes.flatMap((c) => ('put' in c ? [c.put] : [])) : [],
  );

describe('epitaph writing', () => {
  it('writes each grave once for two players arriving together and shows both the same words', async () => {
    const path = tempDb();
    const coord = atGraveyard(path);
    const model = fakeModel();
    const first = open(path, model.writeText);
    const alice = first.join(1);
    const bob = first.join(2);
    const pending = epitaphsIn(screenOf(alice).traces);
    expect(pending.length).toBeGreaterThan(1);
    expect(pending.every((t) => t.source === 'pending')).toBe(true);
    expect(epitaphsIn(screenOf(bob).traces)).toEqual(pending);
    const screenRow = JSON.stringify(getScreen(first.db, coord));

    for (let i = 0; i < pending.length; i++) {
      await vi.waitFor(() => expect(model.asked).toHaveLength(i + 1), { interval: 1 });
      const { request, answer } = model.asked[i]!;
      expect(request.messages.at(-1)!.content).toMatch(/buried in a (graveyard|burial ground) in /);
      answer({ kind: 'ok', text: `"Here lies ${model.nameIn(request)}, gone fishing."` });
    }
    await vi.waitFor(() => expect(writtenIn(bob)).toHaveLength(pending.length), { interval: 1 });
    expect(model.asked).toHaveLength(pending.length);
    expect(writtenIn(alice)).toEqual(writtenIn(bob));
    for (const trace of writtenIn(bob)) {
      expect(trace).toMatchObject({ kind: 'epitaph', source: 'model' });
      expect(trace.kind === 'epitaph' && trace.text).toMatch(/^Here lies \w+, gone fishing\.$/);
    }
    expect(JSON.stringify(getScreen(first.db, coord))).toBe(screenRow);
    first.stop();

    const again = open(path, () => Promise.reject(new Error('asked twice')));
    const back = epitaphsIn(screenOf(again.join(1)).traces);
    expect(back).toEqual(expect.arrayContaining(writtenIn(bob)) as unknown);
    expect(back).toHaveLength(pending.length);
  });

  it('keeps the seed epitaph when the model fails, tries each grave once a run, and again after a restart', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    cleanups.push(() => warn.mockRestore());
    const path = tempDb();
    const coord = atGraveyard(path);
    const failing = vi.fn<WriteText>(() => Promise.resolve({ kind: 'timeout' }));
    const first = open(path, failing);
    first.join(1);
    first.leave(1);
    const alice = first.join(1);
    const pending = epitaphsIn(screenOf(alice).traces);
    await vi.waitFor(() => expect(failing).toHaveBeenCalledTimes(pending.length), { interval: 1 });
    first.leave(1);
    first.join(1);
    await new Promise((r) => setTimeout(r, 20));
    expect(failing).toHaveBeenCalledTimes(pending.length);
    expect(writtenIn(alice)).toEqual([]);
    const world = loadWorld(first.db);
    for (const t of pending) expect(t.text).toBe(seedEpitaph(world, coord, t));
    first.stop();

    const model = fakeModel();
    const again = open(path, model.writeText);
    const bob = again.join(2);
    await vi.waitFor(() => expect(model.asked).toHaveLength(1), { interval: 1 });
    model.asked[0]!.answer({ kind: 'ok', text: 'Rest well.' });
    await vi.waitFor(() => expect(writtenIn(bob)).toHaveLength(1), { interval: 1 });
  });

  it('shows seed epitaphs and asks nothing when no provider is configured', () => {
    const path = tempDb();
    atGraveyard(path);
    const { join } = open(path);
    const graves = epitaphsIn(screenOf(join(1)).traces);
    expect(graves.length).toBeGreaterThan(0);
    expect(graves.every((t) => t.source === 'pending')).toBe(true);
  });

  it('lets an admin replace or clear an epitaph, and a late model answer never overwrites it', async () => {
    const path = tempDb();
    const coord = atGraveyard(path);
    const model = fakeModel();
    const { db, join } = open(path, model.writeText);
    const alice = join(1);
    const [grave, other] = epitaphsIn(screenOf(alice).traces);
    await vi.waitFor(() => expect(model.asked).toHaveLength(1), { interval: 1 });

    expect(setEpitaph(db, coord, grave!, 'Beloved of the crows')).toBe(grave!.text);
    model.asked[0]!.answer({ kind: 'ok', text: 'Too late' });
    await vi.waitFor(() => expect(model.asked).toHaveLength(2), { interval: 1 });
    expect(writtenIn(alice)).toEqual([]);

    expect(setEpitaph(db, coord, other!, undefined)).toBe(other!.text);
    const stored = listEpitaphs(db).filter((e) => e.coord.sx === coord.sx);
    expect(stored).toContainEqual({
      coord,
      tile: { tx: grave!.tx, ty: grave!.ty },
      text: 'Beloved of the crows',
      source: 'admin',
    });
    expect(stored).toContainEqual({
      coord,
      tile: { tx: other!.tx, ty: other!.ty },
      text: seedEpitaph(loadWorld(db), coord, other!),
      source: 'seed',
    });
    expect(setEpitaph(db, coord, { tx: 0, ty: 0 }, 'Nobody')).toBeUndefined();
  });
});
