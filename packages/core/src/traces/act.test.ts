import { describe, expect, test } from 'vitest';
import { bare, placeOf, type Place } from '../place.ts';
import { uniformScreen, withFeatures } from '../testing.ts';
import { facedTile, overlapsBox } from '../walk.ts';
import { SCREEN_W, TILE, type Feature, type Pose } from '../world.ts';
import { REASONS, bubblesAt, promptAt, resolve, type Act } from './act.ts';
import { EMPTY_INVENTORY, parseInventory, slotOf, type Inventory } from './inventory.ts';
import type { Here } from './kind.ts';
import type { Trace } from './registry.ts';

const ME = 7;
const open = bare(uniformScreen());
const pose = (x: number, y: number, dir: Pose['dir'] = 'e'): Pose => ({ x, y, dir, moving: false });
/** Centre tile (10, 7), facing (11, 7); the feet box covers only (10, 7). */
const standing = pose(168, 122);
const probeAt = (tx: number, ty: number, label?: string): Trace =>
  label === undefined ? { kind: 'probe', tx, ty, by: 3 } : { kind: 'probe', tx, ty, by: 3, label };
const holding = (...counts: number[]) =>
  parseInventory(counts.map((count, i) => ({ kind: 'probe', variant: `v${i}`, count })));

function here(
  place: Place,
  me: Pose = standing,
  { inventory = EMPTY_INVENTORY, others = [] }: { inventory?: Inventory; others?: Pose[] } = {},
): Here {
  return { place, me: { id: ME, name: 'me', pose: me }, others, inventory, now: 0 };
}

const use = (me: Pose, slot = 0): Act => ({
  verb: 'use',
  slot: slotOf(slot)!,
  tile: facedTile(me)!,
});
const interact = (me: Pose): Act => ({ verb: 'interact', tile: facedTile(me)! });

describe('resolve refuses', () => {
  test('a tile out of reach', () => {
    const act: Act = { verb: 'use', slot: slotOf(0)!, tile: { tx: 12, ty: 7 } };
    expect(resolve(here(open, standing, { inventory: holding(1) }), act)).toEqual({
      kind: 'refused',
      reason: REASONS.far,
    });
  });

  test('a solid placement on a tile the player stands on, facing south or east', () => {
    const south = pose(168, 112.5, 's');
    const east = pose(172, 122, 'e');
    for (const me of [south, east]) {
      expect(overlapsBox(facedTile(me)!, me)).toBe(true);
      expect(resolve(here(open, me, { inventory: holding(1) }), use(me))).toEqual({
        kind: 'refused',
        reason: REASONS.you,
      });
    }
  });

  test('every south-facing placement onto the tile under the feet, across a whole tile', () => {
    for (let y = 7 * TILE; y < 8 * TILE; y += 0.5) {
      const me = pose(168, y, 's');
      const outcome = resolve(here(open, me, { inventory: holding(1) }), use(me));
      expect(outcome.kind === 'refused' && outcome.reason === REASONS.you).toBe(
        overlapsBox(facedTile(me)!, me),
      );
      expect(outcome.kind === 'done', `placed from y ${y}`).toBe(!overlapsBox(facedTile(me)!, me));
    }
  });

  test("a solid placement on someone else's feet", () => {
    const other = pose(184, 122);
    expect(
      resolve(here(open, standing, { inventory: holding(1), others: [other] }), use(standing)),
    ).toEqual({ kind: 'refused', reason: REASONS.someone });
  });

  test('a solid placement on the screen edge', () => {
    const me = pose(168, 20, 'n');
    expect(facedTile(me)).toEqual({ tx: 10, ty: 0 });
    expect(resolve(here(open, me, { inventory: holding(1) }), use(me))).toEqual({
      kind: 'refused',
      reason: REASONS.edge,
    });
  });

  test('a solid placement that cuts a corridor in two', () => {
    const walls: [number, number, Feature][] = Array.from({ length: SCREEN_W }, (_, tx) => [
      [tx, 6, 'tree'] as [number, number, Feature],
      [tx, 8, 'tree'] as [number, number, Feature],
    ]).flat();
    const corridor = bare(withFeatures(uniformScreen(), walls));
    expect(resolve(here(corridor, standing, { inventory: holding(1) }), use(standing))).toEqual({
      kind: 'refused',
      reason: REASONS.splits,
    });
  });

  test("a pickup past the kind's carry limit, with the kind's text", () => {
    const place = placeOf(uniformScreen(), [probeAt(11, 7)]);
    expect(resolve(here(place, standing, { inventory: holding(2) }), interact(standing))).toEqual({
      kind: 'refused',
      reason: 'You can only carry 2 probes.',
    });
  });

  test("with the kind's own reason when the kind says no", () => {
    const place = placeOf(uniformScreen(), [probeAt(11, 7)]);
    expect(resolve(here(place, standing, { inventory: holding(1) }), use(standing))).toEqual({
      kind: 'refused',
      reason: 'There is a probe here already.',
    });
  });

  test('an action whose input does not parse', () => {
    const act: Act = { verb: 'act', kind: 'probe', input: { tx: 99, ty: 7, label: 'x' } };
    expect(resolve(here(open), act)).toEqual({ kind: 'refused', reason: REASONS.badInput });
  });
});

describe('resolve does nothing', () => {
  test('for an empty slot', () => {
    expect(resolve(here(open, standing, { inventory: holding(1) }), use(standing, 3))).toEqual({
      kind: 'nothing',
    });
  });

  test('for an interact no kind claims', () => {
    expect(resolve(here(open), interact(standing))).toEqual({ kind: 'nothing' });
  });
});

describe('resolve succeeds', () => {
  test('placing spends the item, removes its emptied stack, and puts the trace', () => {
    const inventory = holding(1, 1);
    expect(resolve(here(open, standing, { inventory }), use(standing))).toEqual({
      kind: 'done',
      label: 'Place the probe',
      changes: [{ put: { kind: 'probe', tx: 11, ty: 7, by: ME } }],
      inventory: [{ kind: 'probe', variant: 'v1', count: 1 }],
    });
  });

  test('picking up drops the trace and gains the item', () => {
    const place = placeOf(uniformScreen(), [probeAt(11, 7)]);
    expect(resolve(here(place), interact(standing))).toEqual({
      kind: 'done',
      label: 'Pick up the probe',
      changes: [{ drop: { tx: 11, ty: 7, kind: 'probe' } }],
      inventory: [{ kind: 'probe', variant: 'probe', count: 1 }],
    });
  });

  test("an action rewrites the trace on the tile the kind chose, keeping the kind's fields", () => {
    const place = placeOf(uniformScreen(), [probeAt(2, 2)]);
    const act: Act = { verb: 'act', kind: 'probe', input: { tx: 2, ty: 2, label: 'hi' } };
    expect(resolve(here(place), act)).toEqual({
      kind: 'done',
      label: 'Label the probe',
      changes: [{ put: probeAt(2, 2, 'hi') }],
      inventory: EMPTY_INVENTORY,
    });
  });
});

describe('promptAt', () => {
  test("shows the faced tile's interact label, and nothing on an empty tile", () => {
    expect(promptAt(here(placeOf(uniformScreen(), [probeAt(11, 7)])))).toEqual({
      kind: 'act',
      label: 'Pick up the probe',
    });
    expect(promptAt(here(open))).toBeUndefined();
  });
});

describe('bubblesAt', () => {
  test("shows a labelled trace's text in reach and nothing out of reach", () => {
    const place = placeOf(uniformScreen(), [probeAt(11, 8, 'hello'), probeAt(13, 7, 'far off')]);
    expect(bubblesAt(here(place))).toEqual([{ tile: { tx: 11, ty: 8 }, text: 'hello' }]);
    expect(bubblesAt(here(placeOf(uniformScreen(), [probeAt(11, 8)])))).toEqual([]);
  });
});
