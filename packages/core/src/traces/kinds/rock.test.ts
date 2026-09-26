import { describe, expect, test } from 'vitest';
import { bare, placeOf, withChanges, type Place } from '../../place.ts';
import { CAIRN_MAX } from '../../recipes/index.ts';
import { uniformScreen, withCorners, withFeatures } from '../../testing.ts';
import { isWalkable } from '../../walk.ts';
import type { Pose, Screen } from '../../world.ts';
import { REASONS, bubblesAt, resolve, type Act, type Outcome } from '../act.ts';
import { EMPTY_INVENTORY, parseInventory, slotOf, type Inventory } from '../inventory.ts';
import type { Here } from '../kind.ts';
import type { Trace } from '../registry.ts';

const ME = 7;
/** Centre tile (10, 7), facing (11, 7). */
const me: Pose = { x: 168, y: 122, dir: 'e', moving: false };
const FACED = { tx: 11, ty: 7 };
const highlands = (screen: Screen): Screen => ({ ...screen, biome: 'highlands' });
const rockScreen = highlands(withFeatures(uniformScreen(), [[11, 7, 'rock']]));

const carrying = (...stacks: [string, number][]) =>
  parseInventory(stacks.map(([variant, count]) => ({ kind: 'rock', variant, count })));
const here = (place: Place, inventory: Inventory = EMPTY_INVENTORY, id = ME): Here => ({
  place,
  me: { id, name: 'me', pose: me },
  others: [],
  inventory,
  now: 0,
});
const interact: Act = { verb: 'interact', tile: FACED };
const use: Act = { verb: 'use', slot: slotOf(0)!, tile: FACED };
const cairnOf = (stack: { stone: 'sand' | 'granite' | 'stone'; by?: number }[]): Trace => ({
  kind: 'rock',
  ...FACED,
  stack,
});

function done(outcome: Outcome) {
  if (outcome.kind !== 'done') throw new Error(`expected done, got ${JSON.stringify(outcome)}`);
  return outcome;
}

describe('picking up a rock', () => {
  test('takes a generated rock out of the world as a stone of its species material, no moss', () => {
    const place = bare(rockScreen);
    const outcome = done(resolve(here(place), interact));
    expect(outcome.label).toBe('Pick up the stone');
    expect(outcome.inventory).toEqual([{ kind: 'rock', variant: 'granite', count: 1 }]);
    expect(outcome.changes).toEqual([{ put: { kind: 'rock', ...FACED, stack: [] } }]);
    const after = withChanges(place, outcome.changes);
    expect(isWalkable(after, 11, 7)).toBe(true);
    expect(after.tiles[7 * 20 + 11]!.hidden).toBe(true);
    expect(after.screen).toBe(place.screen);
    expect(after.screen.features[7 * 20 + 11]).toBe('rock');
  });

  test('stacks stones by material up to three', () => {
    const place = bare(rockScreen);
    expect(done(resolve(here(place, carrying(['granite', 1])), interact)).inventory).toEqual([
      { kind: 'rock', variant: 'granite', count: 2 },
    ]);
    expect(resolve(here(place, carrying(['sand', 2], ['granite', 1])), interact)).toEqual({
      kind: 'refused',
      reason: 'You can only carry 3 stones.',
    });
  });

  test('a dropped rock on open ground leaves no trace behind', () => {
    const place = placeOf(uniformScreen(), [cairnOf([{ stone: 'sand', by: 3 }])]);
    const outcome = done(resolve(here(place), interact));
    expect(outcome.changes).toEqual([{ drop: { ...FACED, kind: 'rock' } }]);
    expect(outcome.inventory).toEqual([{ kind: 'rock', variant: 'sand', count: 1 }]);
  });

  test('a stone dropped where a rock was taken is picked up again, and the rock stays gone', () => {
    const place = placeOf(rockScreen, [cairnOf([{ stone: 'sand', by: 3 }])]);
    const outcome = done(resolve(here(place), interact));
    expect(outcome.changes).toEqual([{ put: { kind: 'rock', ...FACED, stack: [] } }]);
    expect(outcome.inventory).toEqual([{ kind: 'rock', variant: 'sand', count: 1 }]);
  });

  test('stones in a cairn stay put', () => {
    const place = placeOf(uniformScreen(), [cairnOf([{ stone: 'sand' }, { stone: 'granite' }])]);
    expect(resolve(here(place), interact)).toEqual({
      kind: 'refused',
      reason: 'Stones in a cairn stay put.',
    });
  });
});

describe('putting a stone down', () => {
  test('drops a loose rock on open ground that blocks the way', () => {
    const place = bare(uniformScreen());
    const outcome = done(resolve(here(place, carrying(['sand', 2])), use));
    expect(outcome.label).toBe('Put the stone down');
    expect(outcome.changes).toEqual([{ put: cairnOf([{ stone: 'sand', by: ME }]) }]);
    expect(outcome.inventory).toEqual([{ kind: 'rock', variant: 'sand', count: 1 }]);
    expect(isWalkable(withChanges(place, outcome.changes), 11, 7)).toBe(false);
  });

  test.each([
    ['a road', withCorners(uniformScreen(), [[12, 8, 'path']]), 'Keep the road clear.'],
    ['water', withCorners(uniformScreen(), [[11, 7, 'water']]), 'It would sink.'],
    ['a bush', withFeatures(uniformScreen(), [[11, 7, 'bush']]), 'Something is in the way.'],
    ['flowers', withFeatures(uniformScreen(), [[11, 7, 'flowers']]), 'Something is in the way.'],
  ])('refuses %s with a reason', (_, screen, reason) => {
    expect(resolve(here(bare(screen), carrying(['sand', 1])), use)).toEqual({
      kind: 'refused',
      reason,
    });
  });

  test('refuses a tile that would cut off the way through', () => {
    const gap = Array.from({ length: 15 }, (_, ty): [number, number, 'bush'] => [11, ty, 'bush']);
    const wall = withFeatures(
      uniformScreen(),
      gap.filter(([, ty]) => ty !== 7),
    );
    expect(resolve(here(bare(wall), carrying(['sand', 1])), use)).toEqual({
      kind: 'refused',
      reason: REASONS.splits,
    });
  });

  test('on a generated rock starts a cairn on it, and one player can build the whole cairn', () => {
    let place = bare(rockScreen);
    const labels: string[] = [];
    for (let n = 1; n < CAIRN_MAX; n++) {
      const outcome = done(resolve(here(place, carrying(['sand', 1])), use));
      labels.push(outcome.label);
      place = withChanges(place, outcome.changes);
    }
    expect(labels[0]).toBe('Start a cairn');
    expect(labels.slice(1)).toEqual(Array(CAIRN_MAX - 2).fill('Add a stone to the cairn'));
    const trace = [...place.traces.values()][0]!;
    expect(trace).toEqual(
      cairnOf([
        { stone: 'granite' },
        ...Array.from({ length: CAIRN_MAX - 1 }, () => ({ stone: 'sand' as const, by: ME })),
      ]),
    );
    expect(resolve(here(place, carrying(['sand', 1])), use)).toEqual({
      kind: 'refused',
      reason: 'This cairn is complete.',
    });
  });

  test('on a loose rock starts a cairn', () => {
    const place = placeOf(uniformScreen(), [cairnOf([{ stone: 'stone', by: 3 }])]);
    const outcome = done(resolve(here(place, carrying(['granite', 1])), use));
    expect(outcome.label).toBe('Start a cairn');
    expect(outcome.changes).toEqual([
      {
        put: cairnOf([
          { stone: 'stone', by: 3 },
          { stone: 'granite', by: ME },
        ]),
      },
    ]);
  });
});

test('a cairn up close shows its stones and builders, and says when it is complete', () => {
  const growing = cairnOf([
    { stone: 'granite' },
    { stone: 'sand', by: 3 },
    { stone: 'sand', by: 3 },
  ]);
  const full = cairnOf([
    { stone: 'granite' },
    ...Array.from({ length: CAIRN_MAX - 1 }, (_, i) => ({ stone: 'sand' as const, by: i % 4 })),
  ]);
  const text = (trace: Trace) => bubblesAt(here(placeOf(uniformScreen(), [trace])))[0]?.bubble.text;
  expect(text(growing)).toBe('Cairn: 3 stones, 1 builder');
  expect(text(full)).toBe(`Complete cairn: ${CAIRN_MAX} stones, 4 builders`);
  expect(text(cairnOf([{ stone: 'sand', by: 3 }]))).toBeUndefined();
});
