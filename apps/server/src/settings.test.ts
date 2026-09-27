import { expect, it } from 'vitest';
import { testHooksOn } from './settings.ts';

it('leaves the test hooks off unless EXPLORE_TEST_HOOKS is 1', () => {
  expect(testHooksOn({})).toBe(false);
  expect(testHooksOn({ EXPLORE_TEST_HOOKS: '' })).toBe(false);
  expect(testHooksOn({ EXPLORE_TEST_HOOKS: '1' })).toBe(true);
  expect(testHooksOn({ EXPLORE_TEST_HOOKS: '1', NODE_ENV: 'test' })).toBe(true);
});

it('refuses a production server with the test hooks on', () => {
  expect(() => testHooksOn({ EXPLORE_TEST_HOOKS: '1', NODE_ENV: 'production' })).toThrow(
    /cannot be on when NODE_ENV is production/,
  );
  expect(testHooksOn({ NODE_ENV: 'production' })).toBe(false);
});

it('refuses a value that looks like it meant something else', () => {
  expect(() => testHooksOn({ EXPLORE_TEST_HOOKS: 'true' })).toThrow(/must be 1 or unset/);
  expect(() => testHooksOn({ EXPLORE_TEST_HOOKS: '0' })).toThrow(/must be 1 or unset/);
});
