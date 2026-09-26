import { expect, test, type Page } from '@playwright/test';
import {
  OVERWORLD,
  encodeScreen,
  generateScreen,
  type WorldSeed,
} from '../packages/core/src/index.ts';
import { playing, probeOutput, signUp, unique, worldDb } from './helpers.ts';

type Coord = { sx: number; sy: number };
type Rect = { x: number; y: number; w: number; h: number };
type MapState = {
  tilePixels: number;
  canvas: { w: number; h: number };
  you: Rect;
  drawn: number;
  screens: Coord[];
};

const mapState = (page: Page) =>
  page.evaluate(() => (window as unknown as { exploreMap: () => MapState }).exploreMap());

const centred = ({ you, canvas }: MapState) =>
  Math.abs(you.x + you.w / 2 - canvas.w / 2) <= 1 &&
  Math.abs(you.y + you.h / 2 - canvas.h / 2) <= 1;

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
  await expect(map).toBeVisible();
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

test('the map opens on you at one size however much is discovered, and shows more in a bigger window', async ({
  page,
}) => {
  const db = worldDb();
  const { seed } = db.prepare('SELECT seed FROM world WHERE id = 1').get() as { seed: WorldSeed };
  await page.setViewportSize({ width: 960, height: 600 });
  await signUp(page, unique('mapsize'));
  await playing(page);
  await page.waitForTimeout(300);

  await page.keyboard.press('m');
  await page.waitForFunction(() => 'exploreMap' in window);
  await expect.poll(async () => (await mapState(page)).drawn).toBeGreaterThan(0);
  const few = await mapState(page);
  expect(few.tilePixels).toBe(3);
  expect(few.you).toMatchObject({ w: 60, h: 45 });
  expect(centred(few)).toBe(true);
  await page.keyboard.press('Escape');

  // A world of 500 discovered screens around the garden, generated as the server would.
  const known = new Set(few.screens.map(({ sx, sy }) => `${sx},${sy}`));
  const many = Array.from({ length: 500 }, (_, i) => ({
    sx: (i % 25) - 12,
    sy: Math.floor(i / 25) - 10,
  }))
    .filter(({ sx, sy }) => !known.has(`${sx},${sy}`))
    .map((c) => encodeScreen(generateScreen({ seed }, { layer: OVERWORLD, ...c })));
  await page.route('/api/map', async (route) => {
    const real = (await (await route.fetch()).json()) as { screens: unknown[] };
    await route.fulfill({ json: { ...real, screens: [...real.screens, ...many] } });
  });

  await page.keyboard.press('m');
  await expect
    .poll(async () => (await mapState(page)).screens.length)
    .toBe(few.screens.length + many.length);
  const big = await mapState(page);
  expect(big.screens.length).toBeGreaterThanOrEqual(500);
  expect(big.tilePixels).toBe(few.tilePixels);
  expect(big.you).toEqual(few.you);
  expect(big.drawn).toBeGreaterThan(few.drawn);
  await page.screenshot({ path: 'e2e/.results/map-overlay-960.png' });

  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect.poll(async () => (await mapState(page)).canvas.w).toBeGreaterThan(few.canvas.w);
  const wide = await mapState(page);
  expect(wide.tilePixels).toBe(few.tilePixels);
  expect(wide.drawn).toBeGreaterThan(big.drawn);
  expect(centred(wide)).toBe(true);
  await page.screenshot({ path: 'e2e/.results/map-overlay-1600.png' });

  // Nothing a player does moves or zooms the map: it stays on them at one size.
  const map = page.getByLabel(/^World map with/);
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 50, box.y + 50, { steps: 5 });
  await page.mouse.up();
  await page.mouse.wheel(0, -500);
  await page.mouse.wheel(0, 500);
  await map.click();
  for (const key of ['ArrowLeft', 'ArrowUp', '+', '=', '-', 'c', 'Home']) {
    await page.keyboard.press(key);
  }
  expect(await mapState(page)).toEqual(wide);
  await expect(page.getByRole('button', { name: 'Centre on me' })).toHaveCount(0);

  await page.goto('/map');
  await page.waitForFunction(() => 'exploreMap' in window);
  await expect.poll(async () => (await mapState(page)).drawn).toBeGreaterThan(0);
  const standalone = await mapState(page);
  expect(standalone.tilePixels).toBe(3);
  expect(centred(standalone)).toBe(true);
  await page.screenshot({ path: 'e2e/.results/map-standalone-1600.png' });
  await page.setViewportSize({ width: 960, height: 600 });
  await expect.poll(async () => (await mapState(page)).canvas.w).toBeLessThan(standalone.canvas.w);
  const narrow = await mapState(page);
  expect(narrow.drawn).toBeLessThan(standalone.drawn);
  expect(centred(narrow)).toBe(true);
  await page.screenshot({ path: 'e2e/.results/map-standalone-960.png' });
});
