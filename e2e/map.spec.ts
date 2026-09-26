import { expect, test, type Page } from '@playwright/test';
import { playing, probeOutput, signUp } from './helpers.ts';

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
      (
        window as unknown as { exploreState: () => { place?: { screen: { coord: Coord } } } }
      ).exploreState().place?.screen.coord,
  );

/** Screens of the garden's chunk that no e2e spec walks onto, though the server stores them. */
const unvisited = Array.from({ length: 16 }, (_, i) => `${i % 4},${Math.floor(i / 4)}`).filter(
  (key) => key !== '0,0' && key !== '0,1',
);

test('the map shows screens players stood on, and logged-out visitors log in first', async ({
  page,
}) => {
  const name = `map${Date.now().toString(36)}`;
  await signUp(page, name);
  await expect(page.getByLabel('Game world')).toBeVisible();
  await playing(page);

  await page.waitForTimeout(300);
  await page.getByRole('link', { name: 'Map' }).click();
  await expect(page.getByLabel(/^World map with/)).toBeVisible();
  await expect.poll(() => mapScreens(page)).toContain('0,0');
  const fresh = await mapScreens(page);
  expect(fresh.filter((key) => unvisited.includes(key))).toEqual([]);
  await page.getByRole('link', { name: 'Back to the game' }).click();
  await playing(page);

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

test('the map opens over the game, keeping the music and the connection', async ({ page }) => {
  const level = await probeOutput(page);
  let sockets = 0;
  page.on('websocket', () => sockets++);
  const tune = () =>
    page.evaluate(
      () => (window as unknown as { exploreAudio: () => { tune?: string } }).exploreAudio().tune,
    );
  const map = page.getByLabel(/^World map with/);
  const game = page.getByLabel('Game world');

  await signUp(page, `mapsnd${Date.now().toString(36)}`);
  await playing(page);
  await page.keyboard.press('Shift');
  await expect.poll(tune).toBe('garden:1');
  await expect.poll(level, { timeout: 10_000 }).toBeGreaterThan(0.002);
  expect(sockets).toBe(1);

  await page.keyboard.press('m');
  await expect(map).toBeFocused();
  await expect(page).toHaveURL(/\/map$/);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowDown');
  expect(await coord(page)).toMatchObject({ sx: 0, sy: 0 });
  expect(await level()).toBeGreaterThan(0.002);
  expect(await tune()).toBe('garden:1');
  await page.screenshot({ path: 'e2e/.results/map-over-game.png' });

  await page.keyboard.press('Escape');
  await expect(map).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Map' }).click();
  await expect(map).toBeVisible();
  await page.goBack();
  await expect(map).toBeHidden();
  await page.keyboard.press('m');
  await expect(map).toBeVisible();
  await page.keyboard.press('m');
  await expect(map).toBeHidden();
  await expect(game).toBeVisible();

  await page.keyboard.down('ArrowDown');
  await expect.poll(() => coord(page), { intervals: [20] }).toMatchObject({ sx: 0, sy: 1 });
  await page.keyboard.up('ArrowDown');
  expect(await level()).toBeGreaterThan(0.002);
  expect(sockets).toBe(1);
});
