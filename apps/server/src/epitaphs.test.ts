import { EPITAPH_MAX, seedEpitaph, type Trace } from '@explore/core';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { cleanEpitaph, listEpitaphs, setEpitaph } from './epitaphs.ts';
import type { TextRequest } from './text-gen.ts';
import {
  GRAVES,
  atGraveyard,
  cleanUp,
  fakeModel,
  isAbout,
  openGame as open,
  screenOf,
  tempDb,
  writtenIn,
} from './testing.ts';
import { getScreen, loadWorld } from './world.ts';
import type { WriteText } from './writer.ts';

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

afterEach(cleanUp);

const epitaphsIn = (traces: readonly Trace[]) =>
  traces.flatMap((t) => (t.kind === 'epitaph' ? [t] : []));

describe('epitaph writing', () => {
  it('writes each grave once for two players arriving together and shows both the same words', async () => {
    const path = tempDb();
    const coord = atGraveyard(path);
    const model = fakeModel();
    const first = open(path, { writeText: model.writeText });
    const alice = first.join(1);
    const bob = first.join(2);
    const pending = epitaphsIn(screenOf(alice).traces);
    expect(pending.length).toBeGreaterThan(1);
    expect(pending.every((t) => t.source === 'pending')).toBe(true);
    expect(epitaphsIn(screenOf(bob).traces)).toEqual(pending);
    const screenRow = JSON.stringify(getScreen(first.db, coord));

    for (let i = 0; i < pending.length; i++) {
      await vi.waitFor(() => expect(model.graves()).toHaveLength(i + 1), { interval: 1 });
      const { request, answer } = model.graves()[i]!;
      expect(request.messages.at(-1)!.content).toMatch(/buried in a (graveyard|burial ground) in /);
      answer({ kind: 'ok', text: `"Here lies ${model.nameIn(request)}, gone fishing."` });
    }
    await vi.waitFor(() => expect(writtenIn(bob)).toHaveLength(pending.length), { interval: 1 });
    expect(model.graves()).toHaveLength(pending.length);
    expect(writtenIn(alice)).toEqual(writtenIn(bob));
    for (const trace of writtenIn(bob)) {
      expect(trace).toMatchObject({ kind: 'epitaph', source: 'model' });
      expect(trace.kind === 'epitaph' && trace.text).toMatch(/^Here lies \w+, gone fishing\.$/);
    }
    expect(JSON.stringify(getScreen(first.db, coord))).toBe(screenRow);
    first.stop();

    const again = open(path, {
      writeText: (request: TextRequest) =>
        isAbout(GRAVES, request) ? Promise.reject(new Error('asked twice')) : new Promise(() => {}),
    });
    const back = epitaphsIn(screenOf(again.join(1)).traces);
    expect(back).toEqual(expect.arrayContaining(writtenIn(bob)) as unknown);
    expect(back).toHaveLength(pending.length);
  });

  it('keeps the seed epitaph when the model fails, tries each grave once a run, and again after a restart', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const path = tempDb();
    const coord = atGraveyard(path);
    const failing = vi.fn<WriteText>(() => Promise.resolve({ kind: 'timeout' }));
    const gravesAsked = () =>
      failing.mock.calls.filter(([request]) => isAbout(GRAVES, request)).length;
    const first = open(path, { writeText: failing });
    first.join(1);
    first.leave(1);
    const alice = first.join(1);
    const pending = epitaphsIn(screenOf(alice).traces);
    await vi.waitFor(() => expect(gravesAsked()).toBe(pending.length), { interval: 1 });
    first.leave(1);
    first.join(1);
    await new Promise((r) => setTimeout(r, 20));
    expect(gravesAsked()).toBe(pending.length);
    expect(writtenIn(alice)).toEqual([]);
    const world = loadWorld(first.db);
    for (const t of pending) expect(t.text).toBe(seedEpitaph(world, coord, t));
    first.stop();

    const model = fakeModel();
    const again = open(path, { writeText: model.writeText });
    const bob = again.join(2);
    await vi.waitFor(() => expect(model.graves()).toHaveLength(1), { interval: 1 });
    model.graves()[0]!.answer({ kind: 'ok', text: 'Rest well.' });
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
    const { db, join } = open(path, { writeText: model.writeText });
    const alice = join(1);
    const [grave, other] = epitaphsIn(screenOf(alice).traces);
    await vi.waitFor(() => expect(model.graves()).toHaveLength(1), { interval: 1 });

    expect(setEpitaph(db, coord, grave!, 'Beloved of the crows')).toBe(grave!.text);
    model.graves()[0]!.answer({ kind: 'ok', text: 'Too late' });
    await vi.waitFor(() => expect(model.graves()).toHaveLength(2), { interval: 1 });
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
