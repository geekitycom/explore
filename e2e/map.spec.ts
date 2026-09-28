import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
import { playing, probeOutput, signUp, unique } from './helpers.ts';

type Coord = { sx: number; sy: number };
type Rect = { x: number; y: number; w: number; h: number };
type MapState = {
  tilePixels: number;
  canvas: { w: number; h: number };
  you: Rect;
  drawn: number;
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

const coord = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { exploreState: () => { place?: { screen: { coord: Coord } } } }
      ).exploreState().place?.screen.coord,
  );

test('the map link goes there and back, and a logged-out visitor logs in first', async ({
  page,
}) => {
  const name = unique('map');
  await signUp(page, name);
  await playing(page);

  await page.getByRole('link', { name: 'Map' }).click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(page.getByLabel(/^World map with/)).toBeVisible();
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

test('the map opens on you at one size, however big the window', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 600 });
  await signUp(page, unique('mapsize'));
  await playing(page);

  await page.keyboard.press('m');
  await page.waitForFunction(() => 'exploreMap' in window);
  const few = await drawnMap(page, (s) => s.drawn > 0);
  expect(few.tilePixels).toBe(6);
  expect(few.you).toMatchObject({ w: 120, h: 90 });
  expect(centred(few)).toBe(true);
  await page.screenshot({ path: 'e2e/.results/map-overlay-960.png' });

  await page.setViewportSize({ width: 1600, height: 1000 });
  const wide = await drawnMap(page, (s) => s.canvas.w > few.canvas.w);
  expect(wide.tilePixels).toBe(6);
  expect(wide.you).toMatchObject({ w: 120, h: 90 });
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
  const narrow = await drawnMap(page, (s) => s.canvas.w < standalone.canvas.w);
  expect(narrow.tilePixels).toBe(6);
  expect(centred(narrow)).toBe(true);
  await page.screenshot({ path: 'e2e/.results/map-standalone-960.png' });
});
