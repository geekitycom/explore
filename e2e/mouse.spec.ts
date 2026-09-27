/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { SCREEN_PX_W, TILE } from '../packages/core/src/index.ts';
import { playing, signUp, unique } from './helpers.ts';

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

test('a held mouse walks around the pond, and a double-click walks on after release and off an edge', async ({
  page,
}) => {
  const corrections: string[] = [];
  await page.routeWebSocket('**/ws/worlds/*', (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => server.send(message));
    server.onMessage((message) => {
      if ((JSON.parse(String(message)) as { t: string }).t === 'correct')
        corrections.push(String(message));
      ws.send(message);
    });
  });
  await signUp(page, unique('route'));
  await playing(page);
  expect((await seen(page)).you).toMatchObject({ x: 10 * TILE, y: 12 * TILE + 10 });

  const beyondPond = await client(page, 10.5 * TILE, 4.5 * TILE);
  await page.mouse.move(beyondPond.x, beyondPond.y);
  await page.mouse.down();
  await expect
    .poll(async () => (await seen(page)).you, { timeout: 10_000 })
    .toMatchObject({ x: 10.5 * TILE, y: 4.5 * TILE + 1.5, moving: false });
  await page.mouse.up();

  await page.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await seen(page)).you!.x).toBeLessThan(9 * TILE);
  await page.keyboard.up('ArrowLeft');
  await page.mouse.down();
  await expect
    .poll(async () => (await seen(page)).you, { timeout: 10_000 })
    .toMatchObject({ x: 10.5 * TILE, y: 4.5 * TILE + 1.5, moving: false });
  await page.mouse.up();

  const east = await client(page, 15.5 * TILE, 4.5 * TILE);
  await page.mouse.dblclick(east.x, east.y);
  await expect
    .poll(async () => (await seen(page)).you, { timeout: 10_000 })
    .toMatchObject({ x: 15.5 * TILE, y: 4.5 * TILE + 1.5, moving: false });

  await page.mouse.dblclick(beyondPond.x, beyondPond.y);
  await expect.poll(async () => (await seen(page)).you!.x).toBeLessThan(15 * TILE);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(100);
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await seen(page)).you!.moving).toBe(false);
  await page.waitForTimeout(300);
  expect((await seen(page)).you!.x).toBeGreaterThan(11 * TILE);

  await page.mouse.move(east.x, east.y + TILE);
  await page.mouse.down();
  await page.mouse.move(east.x, east.y, { steps: 5 });
  await expect
    .poll(async () => (await seen(page)).you, { timeout: 10_000 })
    .toMatchObject({ x: 15.5 * TILE, y: 4.5 * TILE + 1.5, moving: false });
  await page.mouse.up();

  const sx = () =>
    page.evaluate(
      () =>
        (
          window as unknown as {
            exploreState: () => { place?: { screen: { coord: { sx: number } } } };
          }
        ).exploreState().place?.screen.coord.sx,
    );
  const eastEdge = await client(page, SCREEN_PX_W - 2, 7.5 * TILE);
  await page.mouse.dblclick(eastEdge.x, eastEdge.y);
  await expect.poll(sx, { timeout: 10_000 }).toBe(1);
  await expect.poll(async () => (await seen(page)).you!.moving).toBe(false);
  expect((await seen(page)).you!.x).toBeLessThan(TILE);
  expect(corrections).toEqual([]);
});
