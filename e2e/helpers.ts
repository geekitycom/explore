import type { DatabaseSync } from 'node:sqlite';
import type { Page } from '@playwright/test';
import { TILE, type ScreenCoord, type Tile } from '../packages/core/src/index.ts';

export const unique = (tag: string) =>
  `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

export async function signUp(page: Page, name: string) {
  await page.goto('/');
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Create account' }).click();
}

export const playing = (page: Page) =>
  page.waitForFunction(
    () =>
      (window as unknown as { exploreState?: () => { phase: string } }).exploreState?.().phase ===
      'playing',
  );

/**
 * Moves a signed-out player by rewriting their saved position, then signs them back in there.
 * The server saves a position when the socket closes, so the page leaves first.
 */
export async function teleport(
  page: Page,
  db: DatabaseSync,
  user: string,
  coord: ScreenCoord,
  at: Tile,
) {
  await page.goto('about:blank');
  await page.waitForTimeout(500);
  const { id } = db.prepare('SELECT id FROM users WHERE username = ?').get(user) as { id: number };
  db.prepare(
    `UPDATE player_state SET layer = ?, sx = ?, sy = ?, x = ?, y = ?, dir = 'n' WHERE user_id = ?`,
  ).run(coord.layer, coord.sx, coord.sy, (at.tx + 0.5) * TILE, (at.ty + 1) * TILE - 2, id);
  await page.goto('/');
  await playing(page);
}
