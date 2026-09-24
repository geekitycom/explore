import { expect, test } from 'vitest';
import { TILE } from './index.ts';

test('tiles are 16px', () => {
  expect(TILE).toBe(16);
});
