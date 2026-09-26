import { describe, expect, test } from 'vitest';
import { FLORA, FLOWERS, tilePlant } from '../../flora.ts';
import { placeOf, withChanges, type Place } from '../../place.ts';
import { uniformScreen, withFeatures } from '../../testing.ts';
import { OVERWORLD, type Biome, type Feature, type Pose, type Screen } from '../../world.ts';
import { bubblesAt, promptAt, resolve, type Outcome } from '../act.ts';
import { DAY_MS } from '../fields.ts';
import { EMPTY_INVENTORY, parseInventory, slotOf, type Inventory } from '../inventory.ts';
import type { Here } from '../kind.ts';
import { kindNamed, type Trace } from '../registry.ts';
import { GRAVE_HAS_FLOWERS, NOT_A_GRAVE } from './flowers.ts';
import { REGROWING } from './picked.ts';

const T0 = Date.UTC(2026, 8, 25);
const days = (n: number) => T0 + n * DAY_MS;
/** Centre tile (10, 7), facing (11, 7). */
const me: Pose = { x: 168, y: 122, dir: 'e', moving: false };
const FACED = { tx: 11, ty: 7 };

function screenWith(feature: Feature, biome: Biome = 'meadow', sx = 0): Screen {
  const screen = withFeatures(uniformScreen(), [[FACED.tx, FACED.ty, feature]]);
  return { ...screen, biome, coord: { layer: OVERWORLD, sx, sy: 0 } };
}

const speciesOn = (screen: Screen) => tilePlant(screen, FACED.tx, FACED.ty)!.species;

/** The first screen whose faced tile grows a species the test wants. */
function patchWhere(biome: Biome, want: (name: string, family: string) => boolean): Screen {
  for (let sx = 0; ; sx++) {
    const screen = screenWith('flowers', biome, sx);
    const s = speciesOn(screen);
    if (want(s.name, s.recipe.family)) return screen;
  }
}

function here(place: Place, now: number, inventory: Inventory = EMPTY_INVENTORY): Here {
  return { place, me: { id: 7, name: 'wren', pose: me }, others: [], inventory, now };
}

const pick = (place: Place, now: number, inventory?: Inventory) =>
  resolve(here(place, now, inventory), { verb: 'interact', tile: FACED });
const leave = (place: Place, now: number, inventory: Inventory) =>
  resolve(here(place, now, inventory), { verb: 'use', slot: slotOf(0)!, tile: FACED });

function done(outcome: Outcome) {
  if (outcome.kind !== 'done') throw new Error(`expected done, got ${JSON.stringify(outcome)}`);
  return outcome;
}

const bouquet = (variant: string, count = 1) =>
  parseInventory([{ kind: 'flowers', variant, count }]);

const lookAt = (place: Place, trace: Trace, now: number) =>
  kindNamed(trace.kind).look(
    trace,
    { feature: 'flowers', plant: tilePlant(place.screen, trace.tx, trace.ty)?.species },
    now,
  ).recipe;

test('a flower name means one recipe in every biome, so the species left is the one picked', () => {
  for (const flora of Object.values(FLORA)) {
    for (const s of flora.flowers) {
      if (s.recipe.family === 'flower') expect(FLOWERS.get(s.name)?.recipe).toEqual(s.recipe);
    }
  }
});

describe('picking flowers', () => {
  const patch = placeOf(
    patchWhere('meadow', (_, family) => family === 'flower'),
    [],
  );
  const species = speciesOn(patch.screen);

  test('adds the species to the inventory and marks the patch picked at the server time', () => {
    const outcome = done(pick(patch, T0));
    expect(outcome.inventory).toEqual([{ kind: 'flowers', variant: species.name, count: 1 }]);
    expect(outcome.changes).toEqual([{ put: { kind: 'picked', ...FACED, at: T0 } }]);
    expect(promptAt(here(patch, T0))).toEqual({
      kind: 'act',
      label: `Pick the ${species.name.toLowerCase()}`,
    });
  });

  test('stacks by species', () => {
    const first = done(pick(patch, T0));
    const again = done(pick(withChanges(patch, first.changes), days(2), first.inventory));
    expect(again.inventory).toEqual([{ kind: 'flowers', variant: species.name, count: 2 }]);

    const other = placeOf(
      patchWhere('meadow', (name, family) => family === 'flower' && name !== species.name),
      [],
    );
    const mixed = done(pick(other, T0, first.inventory));
    expect(mixed.inventory.map((s) => [s.variant, s.count])).toEqual([
      [species.name, 1],
      [speciesOn(other.screen).name, 1],
    ]);
  });

  test('regrows through sprout and bud, and is refused until in full flower', () => {
    const picked = withChanges(patch, done(pick(patch, T0)).changes);
    const trace = [...picked.traces.values()][0]!;
    const form = (now: number) => {
      const recipe = lookAt(picked, trace, now);
      return recipe?.family === 'flower' ? (recipe.params.form ?? 'bloom') : recipe;
    };
    expect([0, 0.99, 1, 1.99, 2, 30].map((d) => form(days(d)))).toEqual([
      'sprout',
      'sprout',
      'bud',
      'bud',
      'bloom',
      'bloom',
    ]);
    expect(lookAt(picked, trace, days(2))).toEqual(species.recipe);
    expect(picked.tiles[7 * 20 + 11]?.hidden).toBe(true);

    const held = bouquet(species.name);
    expect(pick(picked, days(1.99), held)).toEqual({ kind: 'refused', reason: REGROWING });
    expect(done(pick(picked, days(2), held)).changes).toEqual([
      { put: { kind: 'picked', ...FACED, at: days(2) } },
    ]);
  });

  test('leaves mushrooms in a flower patch alone', () => {
    const mushrooms = placeOf(
      patchWhere('forest', (_, family) => family === 'mushroom'),
      [],
    );
    expect(pick(mushrooms, T0)).toEqual({ kind: 'nothing' });
  });
});

describe('flowers on a grave', () => {
  const grave = placeOf(screenWith('grave'), []);
  const poppies = bouquet('Common poppy', 2);

  test('are refused anywhere but a grave, and the bouquet is kept', () => {
    for (const feature of ['none', 'flowers', 'bones'] as const) {
      expect(leave(placeOf(screenWith(feature), []), T0, poppies)).toEqual({
        kind: 'refused',
        reason: NOT_A_GRAVE,
      });
    }
  });

  test('leave the species on the grave with who left them and when', () => {
    const outcome = done(leave(grave, T0, poppies));
    expect(outcome.changes).toEqual([
      {
        put: {
          kind: 'flowers',
          ...FACED,
          species: 'Common poppy',
          by: { id: 7, name: 'wren' },
          at: T0,
        },
      },
    ]);
    expect(outcome.inventory).toEqual([{ kind: 'flowers', variant: 'Common poppy', count: 1 }]);
  });

  test('show fresh, then wilted, then are gone, and only then take new flowers', () => {
    const left = withChanges(grave, done(leave(grave, T0, poppies)).changes);
    const trace = [...left.traces.values()][0]!;
    const form = (d: number) => {
      const recipe = lookAt(left, trace, days(d));
      return recipe?.family === 'flower' ? recipe.params.form : recipe;
    };
    expect([0, 2.99, 3, 4.99, 5].map(form)).toEqual([
      'bunch',
      'bunch',
      'wilted',
      'wilted',
      undefined,
    ]);

    for (const d of [0, 3, 4.99]) {
      expect(leave(left, days(d), poppies)).toEqual({
        kind: 'refused',
        reason: GRAVE_HAS_FLOWERS,
      });
    }
    const daisies = bouquet('Oxeye daisy');
    const renewed = done(leave(left, days(5), daisies));
    expect(renewed.changes).toEqual([
      {
        put: {
          kind: 'flowers',
          ...FACED,
          species: 'Oxeye daisy',
          by: { id: 7, name: 'wren' },
          at: days(5),
        },
      },
    ]);
    expect(renewed.inventory).toEqual([]);
  });

  test('say who left them while they are there', () => {
    const left = withChanges(grave, done(leave(grave, T0, poppies)).changes);
    const bubbles = (d: number) => bubblesAt(here(left, days(d))).map((b) => b.text);
    expect(bubbles(0)).toEqual(['Common poppy, left by wren']);
    expect(bubbles(4)).toEqual(['Common poppy, left by wren']);
    expect(bubbles(5)).toEqual([]);
  });
});
