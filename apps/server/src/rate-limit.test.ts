import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRateLimiter } from './rate-limit.ts';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => vi.useRealTimers());

it('blocks a key after max hits and frees it exactly when its own window ends', () => {
  const limiter = createRateLimiter({ max: 2, windowMs: 1000 });
  limiter.hit('other');
  vi.advanceTimersByTime(400);
  limiter.hit('a');
  limiter.hit('a');
  expect(limiter.retryAfterMs('a')).toBe(1000);

  vi.advanceTimersByTime(700);
  expect(limiter.retryAfterMs('a')).toBe(300);
  vi.advanceTimersByTime(300);
  expect(limiter.retryAfterMs('a')).toBe(0);
  limiter.hit('a');
  expect(limiter.retryAfterMs('a')).toBe(0);
  limiter.hit('a');
  expect(limiter.retryAfterMs('a')).toBe(1000);
});
