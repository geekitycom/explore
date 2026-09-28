/**
 * Whether the server mounts the test hooks, which let a caller grant items, move players and clear
 * rate limits. `EXPLORE_TEST_HOOKS=1` turns them on; any other value is a typo, not a quiet off.
 * With NODE_ENV=production the server refuses to start rather than run with them, and the
 * production image leaves test-hooks.ts out, so even a start that got past this has no module
 * to load.
 */
export function testHooksOn(env: NodeJS.ProcessEnv): boolean {
  const value = env['EXPLORE_TEST_HOOKS'];
  if (value === undefined || value === '') return false;
  if (value !== '1') throw new Error(`EXPLORE_TEST_HOOKS must be 1 or unset, not "${value}"`);
  if (env['NODE_ENV'] === 'production') {
    throw new Error('EXPLORE_TEST_HOOKS cannot be on when NODE_ENV is production');
  }
  return true;
}
