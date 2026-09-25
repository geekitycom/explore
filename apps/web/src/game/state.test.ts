import { DEFAULT_AVATAR, encodeScreen, secretGarden, type PlayerView } from '@explore/core';
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

function playing(): GameState {
  return applyMessage({ phase: 'connecting' }, { t: 'screen', screen: garden, you, others: [bob] });
}

describe('applyMessage', () => {
  test('a screen message starts play with the decoded screen and its occupants', () => {
    const state = playing();
    expect(state.phase).toBe('playing');
    if (state.phase === 'connecting') throw new Error('unreachable');
    expect(state.screen.coord).toEqual({ layer: 'overworld', sx: 0, sy: 0 });
    expect(state.you).toEqual(you);
    expect([...state.others.keys()]).toEqual([2]);
  });

  test('join, moved, and leave track other players', () => {
    let state = applyMessage(playing(), { t: 'join', player: { ...bob, id: 3, name: 'cy' } });
    state = applyMessage(state, { t: 'moved', id: 3, x: 90, y: 91, dir: 'e', moving: true });
    state = applyMessage(state, { t: 'leave', id: 2 });
    if (state.phase === 'connecting') throw new Error('unreachable');
    expect([...state.others.keys()]).toEqual([3]);
    expect(state.others.get(3)).toMatchObject({ x: 90, y: 91, dir: 'e', moving: true, drawX: 50 });
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
