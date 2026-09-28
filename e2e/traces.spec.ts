import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
import { playing, signUp, unique } from './helpers.ts';

type Hud = {
  hint: string | undefined;
  slots: { label: string; count: number | undefined }[];
};

const hud = (page: Page) =>
  page.evaluate(() => (window as unknown as { exploreHud: () => Hud }).exploreHud());

/** The bar is the bottom of the game frame: exactly as wide as the view and flush under it. */
const expectBarUnderView = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(() => {
        const view = document.querySelector('.game-canvas')!.getBoundingClientRect();
        const bar = document.querySelector('.inventory-bar')!.getBoundingClientRect();
        return {
          left: bar.left - view.left,
          width: bar.width - view.width,
          gap: bar.top - view.bottom,
        };
      }),
    )
    .toEqual({ left: 0, width: 0, gap: 0 });

test('the inventory bar and the hint bar frame the world', async ({ page }) => {
  await signUp(page, unique('hud'));
  await expect(page.getByLabel('Game world')).toBeVisible();
  await playing(page);

  await expect(page.getByRole('navigation', { name: 'Inventory' })).toBeVisible();
  await expect
    .poll(async () => (await hud(page)).slots)
    .toEqual(
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((key) => ({
        label: `Slot ${key}, empty`,
        count: undefined,
      })),
    );
  await expect(page.getByRole('navigation', { name: 'Inventory' })).toHaveText('');
  await expectBarUnderView(page);

  await expect
    .poll(async () => (await hud(page)).hint)
    .toBe('Click and hold where you want to walk. Walk off an edge to explore.');
  await expect(page.getByRole('button', { name: 'Click and hold' })).toBeVisible();
  await page.screenshot({ path: 'e2e/.results/inventory-garden.png' });

  await page.setViewportSize({ width: 360, height: 740 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(360);
  await expect(page.locator('.slot').last()).toBeInViewport();
  await expectBarUnderView(page);
  await page.screenshot({ path: 'e2e/.results/inventory-phone.png' });
});

test('the inventory bar takes its colours from the biome', async ({ page }) => {
  // The garden is grass; rewriting the screen's biome shows the bar carved from desert dune.
  await page.routeWebSocket('**/ws/worlds/*', (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => server.send(message));
    server.onMessage((message) => {
      const parsed = JSON.parse(String(message)) as { t: string; screen?: { biome: string } };
      if (parsed.t === 'screen' && parsed.screen) parsed.screen.biome = 'desert';
      ws.send(JSON.stringify(parsed));
    });
  });
  await signUp(page, unique('dune'));
  await playing(page);

  const bar = page.getByRole('navigation', { name: 'Inventory' });
  await expect
    .poll(() => bar.evaluate((el) => getComputedStyle(el).getPropertyValue('--bar-face').trim()))
    .toBe('#EF914F');
  await expect(bar).toHaveCSS('background-color', 'rgb(239, 145, 79)');
  await expectBarUnderView(page);
  await page.screenshot({ path: 'e2e/.results/inventory-desert.png' });
});
