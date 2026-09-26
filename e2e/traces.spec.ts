import { expect, test, type Page } from '@playwright/test';
import { playing, signUp, unique } from './helpers.ts';

type Hud = {
  hint: string | undefined;
  hintHidden: boolean;
  slots: { key: string; count: number | undefined }[];
};

type Coord = { layer: string; sx: number; sy: number };

const hud = (page: Page) =>
  page.evaluate(() => (window as unknown as { exploreHud: () => Hud }).exploreHud());

const coord = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { exploreState: () => { place?: { screen: { coord: Coord } } } }
      ).exploreState().place?.screen.coord,
  );

test('the inventory bar and the hint bar frame the world', async ({ page }) => {
  await signUp(page, unique('hud'));
  await expect(page.getByLabel('Game world')).toBeVisible();
  await playing(page);

  await expect(page.getByRole('navigation', { name: 'Inventory' })).toBeVisible();
  const { slots } = await hud(page);
  expect(slots.map((s) => s.key)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']);
  expect(slots.every((s) => s.count === undefined)).toBe(true);

  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(50);
  const whileWalking: boolean[] = [];
  for (let t = 50; t < 600; t += 50) {
    whileWalking.push((await hud(page)).hintHidden);
    await page.waitForTimeout(50);
  }
  await page.keyboard.up('ArrowLeft');
  expect(whileWalking.every(Boolean)).toBe(true);

  const released = Date.now();
  await expect.poll(async () => (await hud(page)).hintHidden, { timeout: 1500 }).toBe(false);
  expect(Date.now() - released).toBeGreaterThanOrEqual(400);
  expect((await hud(page)).hint).toBe('Arrow keys or WASD to walk. Walk off an edge to explore.');
  await expect(page.getByRole('status').filter({ hasText: 'Arrow keys' })).toBeVisible();
  await page.screenshot({ path: 'e2e/.results/inventory-garden.png' });

  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(600);
  await page.keyboard.up('ArrowRight');

  await page.keyboard.down('ArrowDown');
  await expect
    .poll(() => coord(page), { intervals: [20] })
    .toEqual({ layer: 'overworld', sx: 0, sy: 1 });
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'e2e/.results/inventory-south.png' });

  await page.setViewportSize({ width: 360, height: 740 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(360);
  await expect(page.locator('.slot').last()).toBeInViewport();
  await page.screenshot({ path: 'e2e/.results/inventory-phone.png' });
});
