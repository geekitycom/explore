import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
import {
  OVERWORLD,
  encodeScreen,
  generateScreen,
  type WorldSeed,
} from '../packages/core/src/index.ts';
import {
  account,
  playing,
  probeOutput,
  signUp,
  standingStill,
  unique,
  worldDb,
} from './helpers.ts';

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

/** The map once `drawn` holds: it draws after its data arrives and again after a resize. */
async function drawnMap(page: Page, drawn: (s: MapState) => boolean): Promise<MapState> {
  let state: MapState | undefined;
  await expect.poll(async () => drawn((state = await mapState(page)))).toBe(true);
  return state!;
}

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
  const name = unique('map');
  await signUp(page, name);
  await expect(page.getByLabel('Game world')).toBeVisible();
  await playing(page);

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
  await standingStill(page);

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

  await signUp(page, unique('mapsnd'));
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
  expect(await coord(page), 'the arrow keys do not walk the player under the map').toMatchObject({
    sx: 0,
    sy: 0,
  });
  expect(await level(), 'the ambience keeps playing under the map').toBeGreaterThan(0.002);
  expect(await tune(), 'the music keeps playing under the map').toBe('garden:1');
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
  await expect.poll(level).toBeGreaterThan(0.002);
  expect(sockets).toBe(1);
});

test('the map opens on you at one size however much is discovered, and shows more in a bigger window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 960, height: 600 });
  const user = unique('mapsize');
  await signUp(page, user);
  const db = worldDb(account(user).home);
  const { seed } = db.prepare('SELECT seed FROM world WHERE id = 1').get() as { seed: WorldSeed };
  await playing(page);

  await page.keyboard.press('m');
  await page.waitForFunction(() => 'exploreMap' in window);
  const few = await drawnMap(page, (s) => s.drawn > 0);
  expect(few.tilePixels).toBe(6);
  expect(few.you).toMatchObject({ w: 120, h: 90 });
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
  await page.route('**/api/worlds/*/map', async (route) => {
    const real = (await (await route.fetch()).json()) as { screens: unknown[] };
    await route.fulfill({ json: { ...real, screens: [...real.screens, ...many] } });
  });

  await page.keyboard.press('m');
  const big = await drawnMap(
    page,
    (s) => s.screens.length === few.screens.length + many.length && s.drawn > few.drawn,
  );
  expect(big.screens.length).toBeGreaterThanOrEqual(500);
  expect(big.tilePixels).toBe(few.tilePixels);
  expect(big.you).toEqual(few.you);
  expect(big.drawn).toBeGreaterThan(few.drawn);
  await page.screenshot({ path: 'e2e/.results/map-overlay-960.png' });

  await page.setViewportSize({ width: 1600, height: 1000 });
  const wide = await drawnMap(page, (s) => s.canvas.w > few.canvas.w && s.drawn > big.drawn);
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
  expect(await mapState(page), 'nothing the player does moves or zooms the map').toEqual(wide);
  await expect(page.getByRole('button', { name: 'Centre on me' })).toHaveCount(0);

  await page.goto('/map');
  await page.waitForFunction(() => 'exploreMap' in window);
  const standalone = await drawnMap(page, (s) => s.drawn > 0);
  expect(standalone.tilePixels).toBe(6);
  expect(centred(standalone)).toBe(true);
  await page.screenshot({ path: 'e2e/.results/map-standalone-1600.png' });
  await page.setViewportSize({ width: 960, height: 600 });
  const narrow = await drawnMap(
    page,
    (s) => s.canvas.w < standalone.canvas.w && s.drawn < standalone.drawn,
  );
  expect(narrow.drawn).toBeLessThan(standalone.drawn);
  expect(centred(narrow)).toBe(true);
  await page.screenshot({ path: 'e2e/.results/map-standalone-960.png' });
});
