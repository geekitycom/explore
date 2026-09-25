import { expect, test, type Page } from '@playwright/test';

type Coord = { sx: number; sy: number };

const mapScreens = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { exploreMap: () => { screens: Coord[] } })
      .exploreMap()
      .screens.map(({ sx, sy }) => `${sx},${sy}`),
  );

const coord = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { exploreState: () => { screen?: { coord: Coord } } }).exploreState()
        .screen?.coord,
  );

test('the map shows discovered screens, and logged-out visitors log in first', async ({ page }) => {
  const name = `map${Date.now().toString(36)}`;
  await page.goto('/');
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByLabel('Game world')).toBeVisible();
  await page.waitForFunction(
    () =>
      (window as unknown as { exploreState?: () => { phase: string } }).exploreState?.().phase ===
      'playing',
  );

  await page.keyboard.down('ArrowDown');
  await expect.poll(() => coord(page), { intervals: [20] }).toMatchObject({ sx: 0, sy: 1 });
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(300);

  await page.getByRole('link', { name: 'Map' }).click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByLabel(/^World map with/)).toBeVisible();
  await expect.poll(() => mapScreens(page)).toEqual(expect.arrayContaining(['0,0', '0,1']));
  await page.screenshot({ path: 'e2e/.results/map.png' });

  await page.getByLabel(/^World map with/).focus();
  await page.keyboard.press('+');
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('link', { name: 'Back to the game' }).click();
  await expect(page.getByLabel('Game world')).toBeVisible();

  await page.context().clearCookies();
  await page.goto('/map');
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByLabel(/^World map with/)).toBeVisible();
  await expect(page).toHaveURL(/\/map$/);
});
