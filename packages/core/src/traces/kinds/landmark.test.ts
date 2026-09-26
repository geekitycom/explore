import { describe, expect, test } from 'vitest';
import { generateScreen } from '../../generate.ts';
import { landmarkOn, signpostSpot } from '../../landmarks.ts';
import { placeOf, withChanges, type Place } from '../../place.ts';
import { uniformScreen, worldOf } from '../../testing.ts';
import { isWalkable } from '../../walk.ts';
import { OVERWORLD, type Pose } from '../../world.ts';
import { REASONS, bubblesAt, promptAt, resolve } from '../act.ts';
import { EMPTY_INVENTORY } from '../inventory.ts';
import type { Here } from '../kind.ts';
import type { Trace } from '../registry.ts';
import { landmark } from './landmark.ts';

const AREA = { x: 10.5, y: 7.5, rx: 4, ry: 3 };
const SITE: Trace = { kind: 'landmark', tx: 10, ty: 7, poi: 'stones', area: AREA };
const ANN = { id: 1, name: 'ann' };
const BOB = { id: 2, name: 'bob' };
const named = (by = ANN, name = 'Old Stones', line?: string): Trace => ({
  ...SITE,
  named: { name, ...(line ? { line } : {}), by, at: 5 },
});

/** Centre tile (10, 8), just south of the signpost spot, in the area. */
const BESIDE: Pose = { x: 168, y: 142, dir: 'n', moving: false };
/** Centre tile (1, 1), far outside the area. */
const AWAY: Pose = { x: 24, y: 30, dir: 'n', moving: false };

function here(place: Place, me = ANN, pose = BESIDE, others: Pose[] = []): Here {
  return { place, me: { ...me, pose }, others, inventory: EMPTY_INVENTORY, now: 9 };
}
const at = (...traces: Trace[]) => placeOf(uniformScreen(), traces);
const naming = (name: string, line = '') =>
  ({ verb: 'act', kind: 'landmark', input: { op: 'name', name, line } }) as const;
const CLEAR = { verb: 'act', kind: 'landmark', input: { op: 'clear' } } as const;

describe('naming a landmark', () => {
  test('is offered only while standing in an unnamed landmark', () => {
    expect(promptAt(here(at(SITE)))).toEqual({
      kind: 'offer',
      label: 'Name this place',
      compose: 'landmark',
    });
    expect(promptAt(here(at(SITE), ANN, AWAY))).toBeUndefined();
    expect(promptAt(here(at(named())))).toBeUndefined();
    expect(promptAt(here(at(named(BOB))))).toBeUndefined();
  });

  test('plants a solid signpost that says the name, the line and the namer', () => {
    const outcome = resolve(here(at(SITE)), naming('  Old   Stones ', 'Where the  hares run'));
    expect(outcome).toMatchObject({
      kind: 'done',
      changes: [
        {
          put: {
            ...SITE,
            named: { name: 'Old Stones', line: 'Where the hares run', by: ANN, at: 9 },
          },
        },
      ],
    });
    const signed = withChanges(at(SITE), outcome.kind === 'done' ? outcome.changes : []);
    expect(isWalkable(signed, 10, 7)).toBe(false);
    expect(bubblesAt(here(signed))).toEqual([
      {
        tile: { tx: 10, ty: 7 },
        kind: 'landmark',
        bubble: {
          text: 'Old Stones',
          line: 'Where the hares run',
          by: ANN,
          credit: 'named by',
        },
      },
    ]);
    expect(bubblesAt(here(at(SITE)))).toEqual([]);
  });

  test('tells a second namer who got there first', () => {
    expect(resolve(here(at(named()), BOB), naming('Mine'))).toEqual({
      kind: 'refused',
      reason: 'ann named this place first.',
    });
  });

  test('refuses a name from outside the landmark, an empty name and one too long', () => {
    expect(resolve(here(at(SITE), ANN, AWAY), naming('Far'))).toEqual({
      kind: 'refused',
      reason: 'Stand in the stone circle to name it.',
    });
    for (const bad of ['   ', 'x'.repeat(31), 'tab\u0007bell'])
      expect(resolve(here(at(SITE)), naming(bad))).toEqual({
        kind: 'refused',
        reason: REASONS.badInput,
      });
    expect(resolve(here(at(SITE)), naming('ok', 'y'.repeat(81)))).toMatchObject({
      kind: 'refused',
    });
  });

  test('refuses to plant the post on someone standing on its spot', () => {
    const onSpot: Pose = { x: 168, y: 126, dir: 'n', moving: false };
    expect(resolve(here(at(SITE), ANN, BESIDE, [onSpot]), naming('Here'))).toEqual({
      kind: 'refused',
      reason: REASONS.someone,
    });
  });

  test('lets the namer rename or clear it, and nobody else', () => {
    expect(resolve(here(at(named())), naming('New'))).toMatchObject({
      kind: 'done',
      label: 'Rename this place',
      changes: [{ put: { named: { name: 'New', by: ANN } } }],
    });
    expect(resolve(here(at(named()), ANN, AWAY), CLEAR)).toMatchObject({
      kind: 'done',
      changes: [{ put: SITE }],
    });
    expect(resolve(here(at(named()), BOB), CLEAR)).toEqual({
      kind: 'refused',
      reason: 'ann named this place first.',
    });
    expect(resolve(here(at(SITE)), CLEAR)).toEqual({
      kind: 'refused',
      reason: 'This place has no name to clear.',
    });
  });
});

describe('settling a landmark', () => {
  test('puts the unnamed site at the generated spot once, and never moves a named one', () => {
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
    const changes = landmark.settle!(empty, world);
    expect(changes).toEqual([
      { put: { kind: 'landmark', ...signpostSpot(screen, found!.area), ...found } },
    ]);
    expect(landmark.settle!(withChanges(empty, changes), world)).toEqual([]);
    expect(landmark.settle!(placeOf(uniformScreen(), [named()]), world)).toEqual([]);
  });
});
