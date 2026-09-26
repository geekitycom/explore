import { expect, test } from 'vitest';
import { openMainDatabase } from './db.ts';
import { userNamed } from './testing.ts';
import { insertUser } from './users.ts';
import { ensureHomeWorld, homeWorld, mayEnter, worldIdSchema, worldOwnedBy } from './worlds.ts';

test('ensuring a home world creates it once, however often it is asked for', () => {
  const db = openMainDatabase(':memory:');
  const alice = insertUser(db, { username: 'alice', passwordHash: 'x' })!;
  const bob = insertUser(db, { username: 'bob', passwordHash: 'x' })!;
  expect(homeWorld(db, alice.id)).toBeUndefined();

  const home = ensureHomeWorld(db, alice.id, 5);
  expect(ensureHomeWorld(db, alice.id, 9)).toBe(home);
  expect(homeWorld(db, alice.id)).toBe(home);
  expect(ensureHomeWorld(db, bob.id)).not.toBe(home);
  expect(db.prepare('SELECT owner_id, host, created_at FROM worlds ORDER BY id').all()).toEqual([
    { owner_id: alice.id, host: null, created_at: 5 },
    { owner_id: bob.id, host: null, created_at: expect.any(Number) as number },
  ]);
  expect(worldOwnedBy(db, 'bob')).toBe(homeWorld(db, bob.id));
  expect(worldOwnedBy(db, 'carol')).toBeUndefined();
  db.close();
});

test('a world id is never reused once its row is gone', () => {
  const db = openMainDatabase(':memory:');
  const alice = insertUser(db, { username: 'alice', passwordHash: 'x' })!;
  const bob = insertUser(db, { username: 'bob', passwordHash: 'x' })!;
  const first = ensureHomeWorld(db, alice.id);
  db.prepare('DELETE FROM worlds WHERE id = ?').run(first);
  expect(ensureHomeWorld(db, bob.id)).toBeGreaterThan(first);
  db.close();
});

test('only the owner may enter a world', () => {
  const db = openMainDatabase(':memory:');
  const alice = insertUser(db, { username: 'alice', passwordHash: 'x' })!;
  const bob = insertUser(db, { username: 'bob', passwordHash: 'x' })!;
  const home = ensureHomeWorld(db, alice.id);
  expect(mayEnter(db, alice, home)).toBe(true);
  expect(mayEnter(db, bob, home)).toBe(false);
  expect(mayEnter(db, userNamed(99, 'nobody'), home)).toBe(false);
  expect(mayEnter(db, alice, worldIdSchema.parse('404'))).toBe(false);
  db.close();
});

test('a world id in a URL is a positive integer', () => {
  expect(worldIdSchema.safeParse('7').success).toBe(true);
  for (const bad of ['0', '-1', '1.5', 'abc', '']) {
    expect(worldIdSchema.safeParse(bad).success).toBe(false);
  }
});
