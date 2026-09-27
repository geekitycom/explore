import { describe, expect, test } from 'vitest';
import { generateScreen } from '../../generate.ts';
import { landmarkOn, signpostSpot } from '../../landmarks.ts';
import { bare, placeOf, withChanges, type Place } from '../../place.ts';
import { uniformScreen, worldOf } from '../../testing.ts';
import { isWalkable } from '../../walk.ts';
import { OVERWORLD, type Pose } from '../../world.ts';
import { REASONS, bubblesAt, promptAt, resolve } from '../act.ts';
import { EMPTY_INVENTORY } from '../inventory.ts';
import type { Here } from '../kind.ts';
import { traceSchema, type Trace, type TraceNamed } from '../registry.ts';
import { LINE_MAX, NAME_MAX, landmark, seedSign } from './landmark.ts';

const AREA = { x: 10.5, y: 7.5, rx: 4, ry: 3 };
const UNSIGNED: TraceNamed<'landmark'> = {
  kind: 'landmark',
  tx: 10,
  ty: 7,
  poi: 'stones',
  area: AREA,
};
const SIGN = {
  name: 'Hollow Stones',
  line: 'The wind keeps count here.',
  source: 'model',
} as const;
const SITE: TraceNamed<'landmark'> = { ...UNSIGNED, sign: SIGN };
const ANN = { id: 1, name: 'ann' };
const BOB = { id: 2, name: 'bob' };
const named = (by = ANN, name = 'Old Stones', line?: string, site = SITE): Trace => ({
  ...site,
  named: { name, ...(line ? { line } : {}), by, at: 5 },
});

const BESIDE: Pose = { x: 168, y: 142, dir: 'n', moving: false };
/** Centre tile (1, 1), far outside the area. */
const AWAY: Pose = { x: 24, y: 30, dir: 'n', moving: false };

function here(place: Place, me = ANN, pose = BESIDE, others: Pose[] = []): Here {
  return { place, me: { ...me, pose }, others, inventory: EMPTY_INVENTORY, now: 9 };
}
const at = (...traces: Trace[]) => placeOf(uniformScreen(), traces);
const naming = (name: string, line = '') =>
  ({ verb: 'act', kind: 'landmark', input: { op: 'name', name, line } }) as const;
const RESTORE = { verb: 'act', kind: 'landmark', input: { op: 'clear' } } as const;
const settle = (place: Place, world = worldOf(1)) => landmark.settle!(place, world);

describe('stored landmarks', () => {
  test('rows from before generated names parse as they are, and new rows parse too', () => {
    const rows = [UNSIGNED, named(ANN, 'Old Stones', 'Hares', UNSIGNED), named(BOB, 'New', '')];
    for (const row of rows) expect(traceSchema.parse(JSON.parse(JSON.stringify(row)))).toEqual(row);
  });
});

describe('seed names', () => {
  const coord = { layer: OVERWORLD, sx: 3, sy: -2 };

  test('are the same for a world, a screen and a tile, and fit the signpost', () => {
    const tile = { tx: 10, ty: 7 };
    expect(seedSign(worldOf(1), coord, tile, 'stones')).toEqual(
      seedSign(worldOf(1), coord, tile, 'stones'),
    );
    expect(seedSign(worldOf(1), coord, tile, 'stones').source).toBe('pending');
    const signs = Array.from({ length: 400 }, (_, seed) =>
      seedSign(worldOf(seed), coord, tile, seed % 2 ? 'stones' : 'burialground'),
    );
    for (const { name, line } of signs) {
      expect(name.length).toBeGreaterThan(2);
      expect(name.length).toBeLessThanOrEqual(NAME_MAX);
      expect(line.length).toBeLessThanOrEqual(LINE_MAX);
    }
    expect(new Set(signs.map((s) => s.name)).size).toBeGreaterThan(100);
    expect(new Set(signs.map((s) => s.line)).size).toBeGreaterThan(8);
  });
});

describe('settling a landmark', () => {
  test('puts a post with seed words at the generated spot once, readable before anyone acts', () => {
    const world = worldOf(3);
    const coord = { layer: OVERWORLD, sx: -1, sy: 0 };
    let found = landmarkOn(world, coord);
    for (let sx = -12; !found && sx < 12; sx++) {
      Object.assign(coord, { sx });
      found = landmarkOn(world, coord);
    }
    expect(found).toBeDefined();
    const screen = generateScreen(world, coord);
    const empty = placeOf(screen, []);
    const spot = signpostSpot(bare(screen), found!.area)!;
    const changes = settle(empty, world);
    expect(changes).toEqual([
      {
        put: {
          kind: 'landmark',
          ...spot,
          ...found,
          sign: seedSign(world, coord, spot, found!.poi),
        },
      },
    ]);
    const settled = withChanges(empty, changes);
    expect(isWalkable(settled, spot.tx, spot.ty)).toBe(false);
    expect(settle(settled, world)).toEqual([]);
  });

  test('gives a site a player named before generated names a sign under the name, in place', () => {
    const old = named(ANN, 'Old Stones', 'Hares', UNSIGNED);
    const world = worldOf(1);
    expect(settle(at(old), world)).toEqual([
      { put: { ...old, sign: seedSign(world, uniformScreen().coord, old, 'stones') } },
    ]);
  });

  test('moves an old unnamed site off a rock that now stands on its spot', () => {
    const rock: Trace = { kind: 'rock', tx: 10, ty: 7, stack: [{ stone: 'stone', by: 1 }] };
    const changes = settle(at(UNSIGNED, rock));
    expect(changes).toMatchObject([
      { drop: { tx: 10, ty: 7, kind: 'landmark' } },
      { put: { kind: 'landmark', poi: 'stones', area: AREA, sign: { source: 'pending' } } },
    ]);
    const put = changes[1]!;
    expect('put' in put && { tx: put.put.tx, ty: put.put.ty }).not.toEqual({ tx: 10, ty: 7 });
  });

  test('leaves an old site with nowhere to stand unposted, and never moves a signed one', () => {
    const walled = placeOf(uniformScreen('grass', 'rock'), [UNSIGNED]);
    expect(settle(walled)).toEqual([]);
    expect(settle(at(SITE))).toEqual([]);
    expect(settle(at(named(BOB)))).toEqual([]);
  });
});

describe('reading a landmark', () => {
  test("shows the land's words with no byline and a player's with who named it", () => {
    expect(bubblesAt(here(at(SITE)))).toEqual([
      { tile: { tx: 10, ty: 7 }, kind: 'landmark', bubble: { text: SIGN.name, line: SIGN.line } },
    ]);
    expect(bubblesAt(here(at(named(BOB, 'Hare Stones', 'Run'))))).toEqual([
      {
        tile: { tx: 10, ty: 7 },
        kind: 'landmark',
        bubble: { text: 'Hare Stones', line: 'Run', by: BOB, credit: 'named by' },
      },
    ]);
    expect(isWalkable(at(SITE), 10, 7)).toBe(false);
    expect(isWalkable(at(UNSIGNED), 10, 7)).toBe(true);
    expect(bubblesAt(here(at(UNSIGNED)))).toEqual([]);
  });

  test('offers anyone by the post a rename, and an old unposted site a first name', () => {
    const rename = { kind: 'offer', label: 'Rename this place', compose: 'landmark' };
    expect(promptAt(here(at(SITE)))).toEqual(rename);
    expect(promptAt(here(at(named(ANN)), BOB))).toEqual(rename);
    expect(promptAt(here(at(SITE), ANN, AWAY))).toBeUndefined();
    expect(promptAt(here(at(UNSIGNED)))).toEqual({ ...rename, label: 'Name this place' });
  });
});

describe('renaming a landmark', () => {
  test("lays anyone's name over the land's, and over someone else's", () => {
    expect(resolve(here(at(SITE)), naming('  Old   Stones ', 'Where the  hares run'))).toEqual({
      kind: 'done',
      label: 'Rename this place',
      changes: [
        {
          put: {
            ...SITE,
            named: { name: 'Old Stones', line: 'Where the hares run', by: ANN, at: 9 },
          },
        },
      ],
      inventory: EMPTY_INVENTORY,
    });
    expect(resolve(here(at(named(ANN)), BOB), naming('Bob Stones'))).toMatchObject({
      kind: 'done',
      changes: [{ put: { sign: SIGN, named: { name: 'Bob Stones', by: BOB } } }],
    });
  });

  test("puts the land's name back for anyone, and only when a player named it", () => {
    expect(resolve(here(at(named(ANN)), BOB), RESTORE)).toEqual({
      kind: 'done',
      label: "Use the land's name",
      changes: [{ put: SITE }],
      inventory: EMPTY_INVENTORY,
    });
    expect(resolve(here(at(SITE)), RESTORE)).toEqual({
      kind: 'refused',
      reason: "This place already carries the land's name.",
    });
  });

  test('refuses from far off, to the words it already shows, and bad input', () => {
    expect(resolve(here(at(SITE), ANN, AWAY), naming('Far'))).toEqual({
      kind: 'refused',
      reason: "Stand by the stone circle's signpost to rename it.",
    });
    expect(resolve(here(at(named(ANN)), BOB, AWAY), RESTORE)).toMatchObject({ kind: 'refused' });
    expect(resolve(here(at(SITE)), naming(SIGN.name, SIGN.line))).toEqual({
      kind: 'refused',
      reason: 'That is already its name.',
    });
    expect(resolve(here(at(named(ANN, 'Old Stones'))), naming('Old Stones'))).toEqual({
      kind: 'refused',
      reason: 'That is already its name.',
    });
    for (const bad of ['   ', 'x'.repeat(31), 'tab\u0007bell'])
      expect(resolve(here(at(SITE)), naming(bad))).toEqual({
        kind: 'refused',
        reason: REASONS.badInput,
      });
  });

  test('renames beside someone standing by the post, since the post is already there', () => {
    const onSpot: Pose = { x: 168, y: 126, dir: 'n', moving: false };
    expect(resolve(here(at(SITE), BOB, BESIDE, [onSpot]), naming('Here'))).toMatchObject({
      kind: 'done',
    });
  });
});

describe('naming an old unposted site', () => {
  test('plants the post from inside the landmark, as before generated names', () => {
    expect(resolve(here(at(UNSIGNED)), naming('Old Stones'))).toMatchObject({
      kind: 'done',
      label: 'Name this place',
      changes: [{ put: { ...UNSIGNED, named: { name: 'Old Stones', by: ANN } } }],
    });
    expect(resolve(here(at(UNSIGNED), ANN, AWAY), naming('Far'))).toEqual({
      kind: 'refused',
      reason: 'Stand in the stone circle to name it.',
    });
    const onSpot: Pose = { x: 168, y: 126, dir: 'n', moving: false };
    expect(resolve(here(at(UNSIGNED), ANN, BESIDE, [onSpot]), naming('Here'))).toEqual({
      kind: 'refused',
      reason: REASONS.someone,
    });
    expect(resolve(here(at(UNSIGNED)), RESTORE)).toMatchObject({ kind: 'refused' });
  });
});
