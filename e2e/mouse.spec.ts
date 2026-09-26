/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { SCREEN_PX_W, TILE } from '../packages/core/src/index.ts';
import { signUp, unique } from './helpers.ts';

type Seen = {
  phase: string | undefined;
  you: { x: number; y: number; moving: boolean } | undefined;
};

const seen = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const state = (
      window as unknown as { exploreState?: () => { phase: string; you?: Seen['you'] } }
    ).exploreState?.();
    return { phase: state?.phase, you: state?.you };
  });

/** Game pixels to page coordinates over the world canvas. */
async function client(page: Page, x: number, y: number) {
  const canvas = page.getByLabel('Game world');
  const box = (await canvas.boundingBox())!;
  const { border, width } = await canvas.evaluate((el) => ({
    border: el.clientLeft,
    width: el.clientWidth,
  }));
  const scale = width / SCREEN_PX_W;
  return { x: box.x + border + x * scale, y: box.y + border + y * scale };
}

test('a mouse wakes the player with a click and walks them while held', async ({ page }) => {
  await signUp(page, unique('mouse'));
  await expect.poll(async () => (await seen(page)).phase).toBe('waking');
  await expect(page.locator('.wake-text')).toHaveCSS('opacity', '1');
  await page.locator('.wake').click();
  await expect.poll(async () => (await seen(page)).phase).toBe('playing');

  const start = (await seen(page)).you!;
  const west = await client(page, start.x - 4 * TILE, start.y - 1.5);
  await page.mouse.move(west.x, west.y);
  await page.mouse.down();
  await expect.poll(async () => (await seen(page)).you!.x).toBeLessThan(start.x - TILE);
  expect((await seen(page)).you!.y).toBeCloseTo(start.y, 0);
  await page.mouse.up();
  await expect.poll(async () => (await seen(page)).you!.moving).toBe(false);
  const stopped = (await seen(page)).you!.x;
  await page.waitForTimeout(300);
  expect((await seen(page)).you!.x).toBe(stopped);

  const right = await client(page, start.x - 4 * TILE, start.y - 1.5);
  await page.mouse.click(right.x, right.y, { button: 'right' });
  await page.waitForTimeout(300);
  expect((await seen(page)).you!.x).toBe(stopped);
});
