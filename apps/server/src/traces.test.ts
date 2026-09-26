import { GARDEN_COORD, parseInventory } from '@explore/core';
import { expect, test } from 'vitest';
import { openWorldDatabase, type WorldDb } from './db.ts';
import { Presence } from './presence.ts';
import { TraceStore } from './traces.ts';
import { userNamed } from './testing.ts';

const PROBE = { kind: 'probe', tx: 5, ty: 5, by: 1 } as const;
const traceCount = (db: WorldDb) =>
  (db.prepare('SELECT count(*) AS n FROM traces').get() as { n: number }).n;

test('a trace lands only together with the inventory it was spent from', () => {
  const db = openWorldDatabase(':memory:');
  const user = userNamed(1, 'ann');
  const store = new TraceStore(db, new Presence());
  const spent = parseInventory([{ kind: 'probe', variant: 'probe', count: 1 }]);

  // With the inventory table gone the inventory write fails after the trace write.
  db.exec('DROP TABLE inventories');
  expect(() => store.commit(GARDEN_COORD, [{ put: PROBE }], user.id, spent)).toThrow();
  expect(traceCount(db)).toBe(0);
  db.close();
});
