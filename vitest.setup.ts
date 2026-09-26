import { afterEach, beforeEach, expect } from 'vitest';

/** A unit test slower than this fails, so slow tests are fixed before they time out elsewhere. */
export const TEST_BUDGET_MS = 1000;

// Bound now, before any test can fake the clock.
const now = performance.now.bind(performance);
let startedAt = 0;

beforeEach(() => {
  startedAt = now();
});

afterEach(() => {
  const ms = now() - startedAt;
  const { currentTestName, testPath } = expect.getState();
  if (ms <= TEST_BUDGET_MS || testPath?.endsWith('.perf.test.ts')) return;
  throw new Error(
    `"${currentTestName}" took ${Math.round(ms)} ms, over the ${TEST_BUDGET_MS} ms budget ` +
      'for one unit test. Make it cheaper instead of raising a timeout: see Testing in README.md.',
  );
});
