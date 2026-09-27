import { EPITAPH_MAX, OVERWORLD, seedEpitaph, type Trace } from '@explore/core';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { openWorldDatabase, type WorldDb } from './db.ts';
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
import { getScreen, loadWorld, savePlayerState } from './world.ts';
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
      name: grave!.name,
      text: 'Beloved of the crows',
      source: 'admin',
    });
    expect(stored).toContainEqual({
      coord,
      tile: { tx: other!.tx, ty: other!.ty },
      name: other!.name,
      text: seedEpitaph(loadWorld(db), coord, other!),
      source: 'seed',
    });
    expect(setEpitaph(db, coord, { tx: 0, ty: 0 }, 'Nobody')).toBeUndefined();
  });
});

/**
 * The graveyard of world 1234567 as the server stored it before graves kept their name: each row
 * is what that code settled, with the name only in the words.
 */
const OLD_SEED = 1234567;
const OLD_GRAVEYARD = { layer: OVERWORLD, sx: 6, sy: 1 };
const OLD_GRAVES = [
  { tx: 9, ty: 7, text: 'Here lies Silas, who loved the rain.', source: 'pending', name: 'Silas' },
  { tx: 10, ty: 7, text: 'Tobias kept bees and grudges.', source: 'model', name: 'Tobias' },
  { tx: 9, ty: 9, text: 'Here lies Ned. Back soon.', source: 'pending', name: 'Ned' },
  { tx: 10, ty: 9, text: 'Beloved of the crows', source: 'admin', name: 'Hattie' },
  { tx: 13, ty: 9, text: 'Here lies Oona, who loved the rain.', source: 'pending', name: 'Oona' },
  { tx: 14, ty: 9, text: 'Tilly sleeps. Do not wake them.', source: 'seed', name: 'Tilly' },
  { tx: 15, ty: 9, text: 'Otto. Came for a visit, stayed.', source: 'pending', name: 'Otto' },
] as const;
const oldRow = ({ tx, ty, text, source }: (typeof OLD_GRAVES)[number]) =>
  JSON.stringify({ kind: 'epitaph', tx, ty, text, source });

const storedRows = (db: WorldDb) =>
  db.prepare("SELECT tx, ty, data FROM traces WHERE kind = 'epitaph' ORDER BY ty, tx").all() as {
    tx: number;
    ty: number;
    data: string;
  }[];

/** A world file holding the old graveyard, with both players standing in it. */
function oldWorld(): string {
  const path = tempDb();
  const db = openWorldDatabase(path);
  db.prepare('UPDATE world SET seed = ? WHERE id = 1').run(OLD_SEED);
  const put = db.prepare(
    `INSERT INTO traces (layer, sx, sy, tx, ty, kind, data, updated_by, updated_at)
     VALUES (?, ?, ?, ?, ?, 'epitaph', ?, NULL, 0)`,
  );
  const { layer, sx, sy } = OLD_GRAVEYARD;
  for (const grave of OLD_GRAVES) put.run(layer, sx, sy, grave.tx, grave.ty, oldRow(grave));
  for (const id of [1, 2])
    savePlayerState(db, id, {
      coord: OLD_GRAVEYARD,
      pose: { x: 4, y: 4, dir: 's', moving: false },
    });
  db.close();
  return path;
}

describe('graves stored before they kept their name', () => {
  it('get the name their words were carved with when the world opens, and keep every word', () => {
    const db = openWorldDatabase(oldWorld());
    const rows = storedRows(db);
    expect(rows).toHaveLength(OLD_GRAVES.length);
    for (const grave of OLD_GRAVES) {
      const row = rows.find((r) => r.tx === grave.tx && r.ty === grave.ty)!;
      expect(JSON.parse(row.data)).toEqual({ ...JSON.parse(oldRow(grave)), name: grave.name });
      expect(row.data).toContain(JSON.stringify(grave.text));
    }
    db.close();
  });

  it('are named once: reopening leaves a stored name alone', () => {
    const path = oldWorld();
    const first = openWorldDatabase(path);
    first
      .prepare(
        `UPDATE traces SET data = json_set(data, '$.name', 'Quentin')
         WHERE kind = 'epitaph' AND tx = 9 AND ty = 7`,
      )
      .run();
    const named = storedRows(first);
    first.close();
    const again = openWorldDatabase(path);
    expect(storedRows(again)).toEqual(named);
    expect(JSON.parse(named[0]!.data)).toMatchObject({ tx: 9, ty: 7, name: 'Quentin' });
    again.close();
  });

  it('show their own words once a player opens the screen, and the model is asked by their names', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const path = oldWorld();
    const model = fakeModel();
    const { db, join } = open(path, { writeText: model.writeText });
    const graves = epitaphsIn(screenOf(join(1)).traces);
    expect(warn).not.toHaveBeenCalled();
    expect(graves).toHaveLength(OLD_GRAVES.length);
    for (const grave of OLD_GRAVES) expect(graves).toContainEqual({ kind: 'epitaph', ...grave });
    expect(storedRows(db)).toHaveLength(OLD_GRAVES.length);

    const pending = OLD_GRAVES.filter((g) => g.source === 'pending');
    for (let i = 0; i < pending.length; i++) {
      await vi.waitFor(() => expect(model.graves()).toHaveLength(i + 1), { interval: 1 });
      model.graves()[i]!.answer({ kind: 'timeout' });
    }
    expect(model.graves().map(({ request }) => model.nameIn(request))).toEqual(
      expect.arrayContaining(pending.map((g) => g.name)) as unknown,
    );
    expect(model.graves()).toHaveLength(pending.length);
  });
});

describe('a grave named outside every name list', () => {
  it('keeps its name and words, is asked about and restored by that name, and lists it', async () => {
    const path = tempDb();
    const coord = atGraveyard(path);
    const first = open(path);
    const [grave] = epitaphsIn(screenOf(first.join(1)).traces);
    first.stop();
    const quentin = { ...grave!, name: 'Quentin', text: 'Quentin minded the geese.' };
    const db = openWorldDatabase(path);
    db.prepare(
      `UPDATE traces SET data = ?
       WHERE layer = ? AND sx = ? AND sy = ? AND tx = ? AND ty = ? AND kind = 'epitaph'`,
    ).run(JSON.stringify(quentin), coord.layer, coord.sx, coord.sy, quentin.tx, quentin.ty);
    db.close();

    const model = fakeModel();
    const again = open(path, { writeText: model.writeText });
    expect(epitaphsIn(screenOf(again.join(1)).traces)).toContainEqual(quentin);
    await vi.waitFor(() => expect(model.graves()).toHaveLength(1), { interval: 1 });
    expect(model.nameIn(model.graves()[0]!.request)).toBe('Quentin');

    setEpitaph(again.db, coord, quentin, undefined);
    const restored = seedEpitaph(loadWorld(again.db), coord, quentin);
    expect(restored).toContain('Quentin');
    expect(listEpitaphs(again.db)).toContainEqual({
      coord,
      tile: { tx: quentin.tx, ty: quentin.ty },
      name: 'Quentin',
      text: restored,
      source: 'seed',
    });
  });
});
