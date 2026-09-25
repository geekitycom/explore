import { describe, expect, test } from 'vitest';
import { MOODS, compose, type NoteEvent } from './compose.ts';

const pitched = (events: readonly NoteEvent[]) =>
  events.filter((e): e is Extract<NoteEvent, { midi: number }> => e.voice !== 'noise');
const interval = (midi: number, root: number) => (((midi - root) % 12) + 12) % 12;

describe.each(MOODS)('compose(%s)', (mood) => {
  const seeds = [1, 2, 3, 42, 777, 123456];

  test('is deterministic per seed and varies across seeds', () => {
    expect(compose(mood, 42)).toEqual(compose(mood, 42));
    const fingerprints = new Set(seeds.map((s) => JSON.stringify(compose(mood, s).events)));
    expect(fingerprints.size).toBeGreaterThan(seeds.length / 2);
  });

  test.each(seeds)('seed %i stays in key, has form, and resolves home', (seed) => {
    const song = compose(mood, seed);
    const outOfKey = pitched(song.events).filter(
      (e) => !song.scale.includes(interval(e.midi, song.root)),
    );
    expect(outOfKey).toEqual([]);

    expect(song.bars).toBe(32);
    const lead = song.events.filter((e) => e.voice === 'lead');
    const rhythmOf = (bar: number) =>
      lead
        .filter((e) => Math.floor(e.step / 16) === bar)
        .map((e) => [e.step % 16, 'len' in e ? e.len : 0]);
    expect(rhythmOf(8)).toEqual(rhythmOf(0));

    const last = pitched(lead).at(-1)!;
    expect(interval(last.midi, song.root)).toBe(0);
    expect(last.step + last.len).toBe(song.steps);
  });

  test('every event fits inside the loop', () => {
    const song = compose(mood, 9);
    expect(song.events.every((e) => e.step >= 0 && e.step < song.steps)).toBe(true);
    expect(pitched(song.events).every((e) => e.step + e.len <= song.steps)).toBe(true);
  });
});

test('moods differ in tempo range', () => {
  const tempo = (mood: (typeof MOODS)[number]) => compose(mood, 5).bpm;
  expect(tempo('meadow')).toBeGreaterThan(tempo('lake'));
});
