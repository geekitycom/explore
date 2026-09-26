import {
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

const screenMessage = (traces: TraceRecord[] = [], wake = false): ServerMessage => ({
  t: 'screen',
  screen: garden,
  traces,
  patch: { x: 0, y: 0 },
  you,
  others: [bob],
  inventory: [],
  wake,
});

function playing(traces: TraceRecord[] = []): GameState {
  return applyMessage({ phase: 'connecting' }, screenMessage(traces));
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

  test('a new session holds still until the player wakes, even through a reconnect', () => {
    const waking = applyMessage({ phase: 'connecting' }, screenMessage([], true));
    expect(waking.phase).toBe('waking');
    expect(applyMessage(waking, screenMessage()).phase).toBe('waking');
    expect(applyMessage(playing(), screenMessage([], true)).phase).toBe('waking');
  });

  test('join, moved, and leave track other players', () => {
    let state = applyMessage(playing(), { t: 'join', player: { ...bob, id: 3, name: 'cy' } });
    state = applyMessage(state, { t: 'moved', id: 3, x: 90, y: 91, dir: 'e', moving: true });
    state = applyMessage(state, { t: 'leave', id: 2 });
    if (state.phase === 'connecting') throw new Error('unreachable');
    expect([...state.others.keys()]).toEqual([3]);
    expect(state.others.get(3)).toMatchObject({ x: 90, y: 91, dir: 'e', moving: true, drawX: 50 });
  });

  test('a profile change renames and restyles that player where they stand', () => {
    const avatar = { ...DEFAULT_AVATAR, shirt: 'purple' as const };
    const state = applyMessage(playing(), { t: 'profile', id: 2, name: 'Bobby', avatar });
    if (state.phase === 'connecting') throw new Error('unreachable');
    expect(state.others.get(2)).toEqual({ ...bob, name: 'Bobby', avatar, drawX: 50, drawY: 60 });
  });

  test('moves for unknown players are ignored', () => {
    const state = playing();
    expect(applyMessage(state, { t: 'moved', id: 99, x: 1, y: 1, dir: 'e', moving: true })).toBe(
      state,
    );
  });

  test('a correction ends a refused travel', () => {
    const playingState = playing();
    if (playingState.phase === 'connecting') throw new Error('unreachable');
    const state = applyMessage(
      { ...playingState, phase: 'travelling' },
      { t: 'correct', x: 1, y: 2 },
    );
    expect(state.phase).toBe('playing');
  });

  test('a correction snaps your position back', () => {
    const state = applyMessage(playing(), { t: 'correct', x: 10, y: 20 });
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
    let state = applyMessage(playing(), {
      t: 'traces',
      changes: [{ put: { kind: 'probe', tx: 3, ty: 3, by: 1 } }, { put: unknown }],
    });
    expect(allTraces(place(state))).toEqual([{ kind: 'probe', tx: 3, ty: 3, by: 1 }]);
    state = applyMessage(state, {
      t: 'traces',
      changes: [{ drop: { tx: 3, ty: 3, kind: 'comet' } }],
    });
    expect(allTraces(place(state))).toHaveLength(1);
    state = applyMessage(state, {
      t: 'traces',
      changes: [{ drop: { tx: 3, ty: 3, kind: 'probe' } }],
    });
    expect(allTraces(place(state))).toEqual([]);
    expect(isWalkable(place(state), 3, 3)).toBe(true);
  });

  test('an inventory message replaces the stacks, dropping what does not parse', () => {
    const state = applyMessage(playing(), {
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
    expect(applyMessage(state, { t: 'refused', reason: 'Too far away. Walk closer.' })).toBe(state);
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
