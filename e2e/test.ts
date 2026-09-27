import { test as base } from '@playwright/test';
import { testHook } from './helpers.ts';

export { expect } from '@playwright/test';

/**
 * Every spec's `test`. The suite shares one server and one client address, so each test first
 * clears the server's rate limits and starts with no history from the tests before it.
 */
export const test = base.extend<{ freshRateLimits: void }>({
  freshRateLimits: [
    async ({ request }, use) => {
      await testHook(request, 'rate-limits', {});
      await use();
    },
    { auto: true },
  ],
});
