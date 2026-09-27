import { describe, expect, test } from 'vitest';
import { STANDING, isDouble, nextWalk, type WalkEvent, type WalkIntent } from './walk-intent.ts';

const here = { x: 100, y: 80 };
const there = { x: 140, y: 60 };

const run = (...events: WalkEvent[]): WalkIntent => events.reduce(nextWalk, STANDING);
const press = (double = false): WalkEvent => ({ kind: 'press', target: here, double });

describe('nextWalk', () => {
  test('a single press walks while held and stops on release', () => {
    expect(run(press())).toEqual({ kind: 'held', target: here, onRelease: 'stop' });
    expect(run(press(), { kind: 'release' })).toEqual(STANDING);
  });

  test('a double press keeps walking to the point after release', () => {
    expect(run(press(true), { kind: 'release' })).toEqual({ kind: 'queued', target: here });
  });

  test('dragging a held press moves its target, and the release queues the new one', () => {
    const dragged = run(press(true), { kind: 'drag', target: there }, { kind: 'release' });
    expect(dragged).toEqual({ kind: 'queued', target: there });
  });

  test('a queued walk ignores drags and releases', () => {
    const queued = run(press(true), { kind: 'release' });
    expect(nextWalk(queued, { kind: 'drag', target: there })).toBe(queued);
    expect(nextWalk(queued, { kind: 'release' })).toBe(queued);
  });

  test('settling ends a queued walk but not a held one', () => {
    expect(run(press(true), { kind: 'release' }, { kind: 'settle' })).toEqual(STANDING);
    expect(run(press(), { kind: 'settle' })).toEqual({
      kind: 'held',
      target: here,
      onRelease: 'stop',
    });
  });

  test('a new press replaces a queued walk, and a cancelled or non-walk press stops it', () => {
    const queued = run(press(true), { kind: 'release' });
    expect(nextWalk(queued, { kind: 'press', target: there, double: false })).toEqual({
      kind: 'held',
      target: there,
      onRelease: 'stop',
    });
    expect(nextWalk(queued, { kind: 'cancel' })).toEqual(STANDING);
    expect(run(press(true), { kind: 'cancel' }, { kind: 'release' })).toEqual(STANDING);
  });
});

describe('isDouble', () => {
  const first = { at: 1000, point: here };

  test('a second press soon after and close by is a double', () => {
    expect(isDouble(first, { at: 1300, point: { x: 104, y: 83 } })).toBe(true);
  });

  test('too late, too far, or with no first press is not', () => {
    expect(isDouble(first, { at: 1500, point: here })).toBe(false);
    expect(isDouble(first, { at: 1100, point: { x: 112, y: 80 } })).toBe(false);
    expect(isDouble(undefined, first)).toBe(false);
  });
});
