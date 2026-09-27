import {
  type Arrival,
  DEFAULT_AVATAR,
  allTraces,
  encodeScreen,
  isWalkable,
  secretGarden,
  type PlayerView,
  type ServerMessage,
  type TraceRecord,
} from '@explore/core';
import { describe, expect, test } from 'vitest';
import { applyMessage, interpolate, type GameState } from './state.ts';

const garden = encodeScreen(secretGarden());
const bob: PlayerView = {
  id: 2,
  name: 'bob',
  avatar: DEFAULT_AVATAR,
  x: 50,
  y: 60,
  dir: 's',
  moving: false,
};
const you = { x: 160, y: 200, dir: 'n' as const, moving: false };

const NONE: Arrival = { kind: 'none' };
const WAKE: Arrival = { kind: 'wake' };
const PORTAL = { tx: 9, ty: 11 };
const NOW = 1000;

const screenMessage = (traces: TraceRecord[] = [], arrival: Arrival = NONE): ServerMessage => ({
  t: 'screen',
  screen: garden,
  traces,
  patch: { x: 0, y: 0 },
  you,
  others: [bob],
  inventory: [],
  arrival,
  suggestions: false,
});

/** A message that opens no portal, so when it arrives does not matter. */
const apply = (state: GameState, message: ServerMessage) => applyMessage(state, message, NOW);

function playing(traces: TraceRecord[] = []): GameState {
  return applyMessage({ phase: 'connecting' }, screenMessage(traces), NOW);
}

function place(state: GameState) {
  if (state.phase === 'connecting') throw new Error('not playing');
  return state.place;
}

/** A kind this client has never heard of, as a newer server might send. */
const unknown = { kind: 'comet', tx: 4, ty: 4 } as unknown as TraceRecord;

describe('applyMessage', () => {
  test('a screen message starts play with the decoded screen and its occupants', () => {
    const state = playing();
    expect(state.phase).toBe('playing');
    if (state.phase === 'connecting') throw new Error('unreachable');
    expect(state.place.screen.coord).toEqual({ layer: 'overworld', sx: 0, sy: 0 });
    expect(state.you).toEqual(you);
    expect([...state.others.keys()]).toEqual([2]);
  });

  test("a visitor's arrival starts play at once, with no wake-up, out of a portal", () => {
    const visiting = applyMessage(
      { phase: 'connecting' },
      screenMessage([], { kind: 'visit', portal: PORTAL }),
      NOW,
    );
    expect(visiting).toMatchObject({
      phase: 'playing',
      portals: [{ kind: 'arrive', tile: PORTAL, start: NOW, traveller: 'you' }],
    });
    expect(playing()).toMatchObject({ portals: [] });
  });

  test('going home opens a portal that takes you', () => {
    const leaving = applyMessage(
      playing(),
      { t: 'depart', portal: PORTAL, reason: 'closed' },
      1500,
    );
    expect(leaving).toMatchObject({
      phase: 'playing',
      portals: [{ kind: 'depart', tile: PORTAL, start: 1500, traveller: 'you' }],
    });
  });

  test('another visitor comes and goes through portals, drawn where they were last seen', () => {
    let state = applyMessage(
      playing(),
      { t: 'join', player: { ...bob, id: 3, name: 'cy' }, portal: PORTAL },
      1200,
    );
    state = applyMessage(state, { t: 'leave', id: 2, portal: { tx: 3, ty: 3 } }, 1300);
    if (state.phase === 'connecting') throw new Error('unreachable');
    expect([...state.others.keys()]).toEqual([3]);
    expect(state.portals).toEqual([
      { kind: 'arrive', tile: PORTAL, start: 1200, traveller: { ...bob, id: 3, name: 'cy' } },
      { kind: 'depart', tile: { tx: 3, ty: 3 }, start: 1300, traveller: bob },
    ]);
  });

  test('an ordinary join or leave, a walk or a reconnect, opens no portal', () => {
    let state = applyMessage(playing(), { t: 'join', player: { ...bob, id: 3 } }, 1200);
    state = applyMessage(state, { t: 'leave', id: 2 }, 1300);
    expect(state).toMatchObject({ portals: [] });
  });

  test('a new session holds still until the player wakes, even through a reconnect', () => {
    const waking = applyMessage({ phase: 'connecting' }, screenMessage([], WAKE), NOW);
    expect(waking.phase).toBe('waking');
    expect(applyMessage(waking, screenMessage(), NOW).phase).toBe('waking');
    expect(apply(playing(), screenMessage([], WAKE)).phase).toBe('waking');
  });

  test('join, moved, and leave track other players', () => {
    let state = apply(playing(), { t: 'join', player: { ...bob, id: 3, name: 'cy' } });
    state = apply(state, { t: 'moved', id: 3, x: 90, y: 91, dir: 'e', moving: true });
    state = apply(state, { t: 'leave', id: 2 });
    if (state.phase === 'connecting') throw new Error('unreachable');
    expect([...state.others.keys()]).toEqual([3]);
    expect(state.others.get(3)).toMatchObject({ x: 90, y: 91, dir: 'e', moving: true, drawX: 50 });
  });

  test('a profile change renames and restyles that player where they stand', () => {
    const avatar = { ...DEFAULT_AVATAR, shirt: 'purple' as const };
    const state = apply(playing(), { t: 'profile', id: 2, name: 'Bobby', avatar });
    if (state.phase === 'connecting') throw new Error('unreachable');
    expect(state.others.get(2)).toEqual({ ...bob, name: 'Bobby', avatar, drawX: 50, drawY: 60 });
  });

  test('moves for unknown players are ignored', () => {
    const state = playing();
    expect(apply(state, { t: 'moved', id: 99, x: 1, y: 1, dir: 'e', moving: true })).toBe(state);
  });

  test('a correction ends a refused travel', () => {
    const playingState = playing();
    if (playingState.phase === 'connecting') throw new Error('unreachable');
    const state = apply({ ...playingState, phase: 'travelling' }, { t: 'correct', x: 1, y: 2 });
    expect(state.phase).toBe('playing');
  });

  test('a correction snaps your position back', () => {
    const state = apply(playing(), { t: 'correct', x: 10, y: 20 });
    if (state.phase === 'connecting') throw new Error('unreachable');
    expect(state.you).toEqual({ ...you, x: 10, y: 20 });
  });
});

describe('traces and inventory', () => {
  test('a screen arrives with its traces, dropping kinds this client does not know', () => {
    const probe = { kind: 'probe', tx: 5, ty: 6, by: 1 } as const;
    expect(isWalkable(place(playing()), 5, 6)).toBe(true);
    const arrived = place(playing([probe, unknown]));
    expect(allTraces(arrived)).toEqual([probe]);
    expect(isWalkable(arrived, 5, 6)).toBe(false);
  });

  test('trace changes put and drop, and skip unknown kinds', () => {
    let state = apply(playing(), {
      t: 'traces',
      changes: [{ put: { kind: 'probe', tx: 3, ty: 3, by: 1 } }, { put: unknown }],
    });
    expect(allTraces(place(state))).toEqual([{ kind: 'probe', tx: 3, ty: 3, by: 1 }]);
    state = apply(state, {
      t: 'traces',
      changes: [{ drop: { tx: 3, ty: 3, kind: 'comet' } }],
    });
    expect(allTraces(place(state))).toHaveLength(1);
    state = apply(state, {
      t: 'traces',
      changes: [{ drop: { tx: 3, ty: 3, kind: 'probe' } }],
    });
    expect(allTraces(place(state))).toEqual([]);
    expect(isWalkable(place(state), 3, 3)).toBe(true);
  });

  test('an inventory message replaces the stacks, dropping what does not parse', () => {
    const state = apply(playing(), {
      t: 'inventory',
      stacks: [
        { kind: 'probe', variant: 'probe', count: 2 },
        { kind: 'comet', variant: 'x', count: 1 } as never,
      ],
    });
    if (state.phase === 'connecting') throw new Error('not playing');
    expect(state.inventory).toEqual([{ kind: 'probe', variant: 'probe', count: 2 }]);
  });

  test('a refusal changes nothing', () => {
    const state = playing();
    expect(apply(state, { t: 'refused', reason: 'Too far away. Walk closer.' })).toBe(state);
  });
});

describe('interpolate', () => {
  test('eases toward the reported position and snaps across large jumps', () => {
    const near = new Map([[2, { ...bob, x: 60, drawX: 50, drawY: 60 }]]);
    const eased = interpolate(near, 1 / 60).get(2)!;
    expect(eased.drawX).toBeGreaterThan(50);
    expect(eased.drawX).toBeLessThan(60);
    const far = new Map([[2, { ...bob, x: 300, drawX: 50, drawY: 60 }]]);
    expect(interpolate(far, 1 / 60).get(2)!.drawX).toBe(300);
  });
});
