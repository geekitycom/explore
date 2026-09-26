import { expect, test } from 'vitest';
import { WHOOSH_S, whooshAt } from './whoosh.ts';

const samples = (step = 0.01) =>
  Array.from({ length: Math.round(WHOOSH_S / step) + 1 }, (_, i) => whooshAt(i * step));

test('the whoosh lasts about two seconds and is silent at both ends', () => {
  expect(WHOOSH_S).toBeGreaterThanOrEqual(1.8);
  expect(WHOOSH_S).toBeLessThanOrEqual(2.2);
  expect(whooshAt(0).gain).toBe(0);
  expect(whooshAt(WHOOSH_S).gain).toBe(0);
  expect(Math.max(...samples().map((s) => s.gain))).toBeGreaterThan(0.8);
});

test('its pitch rises and falls again, more than once, like a wheeze', () => {
  const hz = samples().map((s) => s.hz);
  let peaks = 0;
  for (let i = 1; i < hz.length - 1; i++) if (hz[i]! > hz[i - 1]! && hz[i]! >= hz[i + 1]!) peaks++;
  expect(peaks).toBeGreaterThanOrEqual(2);
  expect(Math.max(...hz) / Math.min(...hz)).toBeGreaterThan(1.4);
  expect(Math.min(...hz)).toBeGreaterThan(40);
});

test('the filter opens with the pitch, so the voice brightens as it rises', () => {
  const s = samples();
  const top = s.reduce((a, b) => (b.hz > a.hz ? b : a));
  const bottom = s.reduce((a, b) => (b.hz < a.hz ? b : a));
  expect(top.cutoff).toBeGreaterThan(bottom.cutoff * 3);
});
