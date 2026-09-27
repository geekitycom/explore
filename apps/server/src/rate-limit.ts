type Limit = { max: number; windowMs: number };

const MINUTE = 60_000;

export const AUTH_LIMITS = {
  signupsPerAddress: { max: 20, windowMs: 60 * MINUTE },
  loginsPerAddress: { max: 30, windowMs: 15 * MINUTE },
  failedLoginsPerAddressAndUsername: { max: 10, windowMs: 15 * MINUTE },
} satisfies Record<string, Limit>;

/** Guesses at visit codes: 23^5 codes against these budgets is not a brute force anyone finishes. */
export const VISIT_LIMITS = {
  codesPerUser: { max: 10, windowMs: 15 * MINUTE },
  codesPerAddress: { max: 30, windowMs: 15 * MINUTE },
} satisfies Record<string, Limit>;

export type RateLimiter = ReturnType<typeof createRateLimiter>;

export function createRateLimiter({ max, windowMs }: Limit) {
  const windows = new Map<string, { count: number; resetAt: number }>();
  let sweepAt = 0;

  const current = (key: string, now: number) => {
    if (now >= sweepAt) {
      for (const [k, w] of windows) if (now >= w.resetAt) windows.delete(k);
      sweepAt = now + windowMs;
    }
    const w = windows.get(key);
    return w && now < w.resetAt ? w : undefined;
  };

  return {
    /** Milliseconds until `key` may try again, or 0 when it is not blocked. */
    retryAfterMs(key: string): number {
      const now = Date.now();
      const w = current(key, now);
      return w && w.count >= max ? w.resetAt - now : 0;
    },
    hit(key: string): void {
      const now = Date.now();
      const w = current(key, now);
      if (w) w.count++;
      else windows.set(key, { count: 1, resetAt: now + windowMs });
    },
    reset(key: string): void {
      windows.delete(key);
    },
  };
}
