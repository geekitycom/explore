import { describe, expect, test } from 'vitest';
import { allTraces, bare, placeOf, traceAt, tracesOn, withChanges } from './place.ts';
import { uniformScreen, withFeatures } from './testing.ts';
import { LIMITS, parseTraces, traceSchema, type Trace } from './traces/registry.ts';
import { isWalkable } from './walk.ts';

const open = uniformScreen();
const probeAt = (
  tx: number,
  ty: number,
  extra: { label?: string; hides?: boolean } = {},
): Trace => ({
  kind: 'probe',
  tx,
  ty,
  by: 1,
  ...extra,
});

describe('withChanges', () => {
  test('applying the same changes twice gives the same place as once', () => {
    const changes = [{ put: probeAt(4, 4) }, { drop: { tx: 5, ty: 5, kind: 'probe' as const } }];
    const start = placeOf(open, [probeAt(5, 5)]);
    const once = withChanges(start, changes);
    const twice = withChanges(once, changes);
    expect(allTraces(twice)).toEqual(allTraces(once));
    expect(twice.tiles).toEqual(once.tiles);
    expect(allTraces(once)).toEqual([probeAt(4, 4)]);
  });

  test('leaves the place it was given unchanged and returns a new one', () => {
    const start = placeOf(open, [probeAt(5, 5)]);
    const next = withChanges(start, [{ drop: { tx: 5, ty: 5, kind: 'probe' } }]);
    expect(next).not.toBe(start);
    expect(allTraces(start)).toEqual([probeAt(5, 5)]);
    expect(isWalkable(start, 5, 5)).toBe(false);
    expect(isWalkable(next, 5, 5)).toBe(true);
  });

  test('a put replaces the trace of the same kind on the tile rather than adding another', () => {
    const place = withChanges(placeOf(open, [probeAt(5, 5)]), [
      { put: probeAt(5, 5, { label: 'hi' }) },
    ]);
    expect(tracesOn(place, { tx: 5, ty: 5 })).toEqual([probeAt(5, 5, { label: 'hi' })]);
    expect(traceAt(place, { tx: 5, ty: 5 }, 'probe')?.label).toBe('hi');
  });
});

describe('walkability with traces', () => {
  test('a solid trace makes its tile unwalkable', () => {
    expect(isWalkable(bare(open), 5, 5)).toBe(true);
    expect(isWalkable(placeOf(open, [probeAt(5, 5)]), 5, 5)).toBe(false);
  });

  test('a trace that hides a blocking feature and is not solid opens the tile', () => {
    const rock = withFeatures(open, [[5, 5, 'rock']]);
    const place = placeOf(rock, [probeAt(5, 5, { hides: true })]);
    expect(isWalkable(bare(rock), 5, 5)).toBe(false);
    expect(place.tiles[5 * 20 + 5]).toMatchObject({ walkable: true, hidden: true });
  });

  test('a trace that does not hide the feature leaves a blocking feature blocking', () => {
    const rock = withFeatures(open, [[5, 5, 'rock']]);
    expect(isWalkable(placeOf(rock, [probeAt(5, 5)]), 5, 5)).toBe(false);
  });
});

describe('traceSchema', () => {
  test('a probe survives a trip through JSON', () => {
    const trace = probeAt(3, 9, { label: 'north' });
    expect(traceSchema.parse(JSON.parse(JSON.stringify(trace)))).toEqual(trace);
  });

  test('an unknown kind or an off-screen tile fails, and parseTraces drops them', () => {
    const unknown = { kind: 'dragon', tx: 1, ty: 1 };
    const offScreen = { ...probeAt(0, 0), tx: 20 };
    expect(traceSchema.safeParse(unknown).success).toBe(false);
    expect(traceSchema.safeParse(offScreen).success).toBe(false);
    expect(parseTraces([unknown, probeAt(2, 2), offScreen])).toEqual([probeAt(2, 2)]);
  });
});

test('LIMITS is the one table of per-kind limits', () => {
  expect(LIMITS).toMatchInlineSnapshot(`
    {
      "flowers": {
        "freshDays": 3,
        "goneDays": 5,
      },
      "picked": {
        "regrowDays": 2,
      },
      "probe": {
        "carry": 2,
      },
    }
  `);
});
