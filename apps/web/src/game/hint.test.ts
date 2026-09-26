import type { Prompt } from '@explore/core';
import { describe, expect, test } from 'vitest';
import { MESSAGE_MS, STILL_MS, WALK_TIP, hintText, type HintInput } from './hint.ts';

const prompt: Prompt = { kind: 'act', label: 'Pick up the probe' };
const base: HintInput = {
  now: 10_000,
  stillSince: undefined,
  message: undefined,
  prompt,
  tip: true,
};

describe('hintText', () => {
  test('is hidden while moving', () => {
    expect(hintText(base)).toBeUndefined();
  });

  test('is hidden until the player has stood still for STILL_MS', () => {
    expect(STILL_MS).toBe(500);
    expect(hintText({ ...base, stillSince: base.now - 499 })).toBeUndefined();
    expect(hintText({ ...base, stillSince: base.now - 500 })).toEqual({
      text: 'Pick up the probe',
      actionable: true,
    });
  });

  test('an offer is taken by a click, the same as an act', () => {
    const offer: Prompt = { kind: 'offer', label: 'Name this place', compose: 'landmark' };
    expect(hintText({ ...base, stillSince: 0, prompt: offer })).toEqual({
      text: 'Name this place',
      actionable: true,
    });
  });

  test('without a prompt the walking tip shows only while it is due', () => {
    const still = { ...base, stillSince: 0, prompt: undefined };
    expect(hintText(still)).toEqual({ text: WALK_TIP, actionable: false });
    expect(hintText({ ...still, tip: false })).toBeUndefined();
  });

  test('a message shows at once while moving, then yields to the prompt', () => {
    const message = { text: 'Too far away. Walk closer.', until: base.now + MESSAGE_MS };
    const shown = { text: message.text, actionable: false };
    expect(hintText({ ...base, message })).toEqual(shown);
    expect(hintText({ ...base, message, now: base.now + MESSAGE_MS - 1 })).toEqual(shown);
    expect(MESSAGE_MS).toBe(2500);
    expect(
      hintText({ ...base, message, now: base.now + MESSAGE_MS, stillSince: base.now }),
    ).toEqual({ text: 'Pick up the probe', actionable: true });
  });
});
