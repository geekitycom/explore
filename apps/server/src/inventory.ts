import type { WorldDb } from './db.ts';
import { EMPTY_INVENTORY, parseInventory, type Inventory } from '@explore/core';

export function loadInventory(db: WorldDb, userId: number): Inventory {
  const row = db.prepare('SELECT items FROM inventories WHERE user_id = ?').get(userId) as
    { items: string } | undefined;
  return row ? parseInventory(JSON.parse(row.items)) : EMPTY_INVENTORY;
}

export function saveInventory(db: WorldDb, userId: number, inventory: Inventory): void {
  db.prepare(
    `INSERT INTO inventories (user_id, items, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET items = excluded.items, updated_at = excluded.updated_at`,
  ).run(userId, JSON.stringify(inventory), Date.now());
}
