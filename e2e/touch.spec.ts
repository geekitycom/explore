/// <reference lib="dom" />
import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { GARDEN_SPAWN, SCREEN_PX_W, TILE, type Tile } from '../packages/core/src/index.ts';
import { unique } from './helpers.ts';

type Seen = {
  phase: string;
  you: { x: number; y: number; moving: boolean } | undefined;
  inventory: { variant: string; count: number }[] | undefined;
  rocks: { tx: number; ty: number; stack: unknown[] }[];
};

const seen = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const state = (
      window as unknown as {
        exploreState: () => {
          phase: string;
          you?: Seen['you'];
          inventory?: Seen['inventory'];
          place?: { traces: Map<string, { kind: string; tx: number; ty: number; stack: [] }> };
        };
      }
    ).exploreState();
    return {
      phase: state.phase,
      you: state.you,
      inventory: state.inventory,
      rocks: [...(state.place?.traces.values() ?? [])].filter((t) => t.kind === 'rock'),
    };
  });

const phase = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { exploreState?: () => { phase: string } }).exploreState?.().phase,
  );

/** The tile in reach north of the garden spawn, open ground with room around it. */
const SPOT: Tile = { tx: 10, ty: 11 };
const rockAt = async (page: Page, { tx, ty }: Tile) =>
  (await seen(page)).rocks.find((r) => r.tx === tx && r.ty === ty && r.stack.length > 0);

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

const tileCentre = (page: Page, { tx, ty }: Tile) =>
  client(page, (tx + 0.5) * TILE, (ty + 0.5) * TILE);

const FINGER = 7;

/**
 * Playwright's touchscreen only taps, so a held or dragged finger is dispatched as touch pointer
 * events on the canvas, where pointer capture would deliver them. No real pointer backs them, so
 * capturing one would throw; the page skips capture for this finger alone.
 */
async function finger(page: Page) {
  await page.evaluate((id) => {
    const proto = Element.prototype;
    const capture = Object.getOwnPropertyDescriptor(proto, 'setPointerCapture')!.value as (
      this: Element,
      pointerId: number,
    ) => void;
    proto.setPointerCapture = function (pointerId) {
      if (pointerId !== id) capture.call(this, pointerId);
    };
  }, FINGER);
  const fire = (type: string, at: { x: number; y: number }) =>
    page.getByLabel('Game world').dispatchEvent(type, {
      pointerId: FINGER,
      pointerType: 'touch',
      isPrimary: true,
      button: type === 'pointermove' ? -1 : 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: at.x,
      clientY: at.y,
    });
  return {
    down: (at: { x: number; y: number }) => fire('pointerdown', at),
    move: (at: { x: number; y: number }) => fire('pointermove', at),
    up: (at: { x: number; y: number }) => fire('pointerup', at),
  };
}

/** Creates an account by tapping, carrying `stones`, and taps through to the game. */
async function signUpByTouch(page: Page, name: string, stones: string[]) {
  await page.setExtraHTTPHeaders({
    'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 250)}`,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).tap();
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password', { exact: true }).fill('correct horse');
  await page.getByLabel('Password again').fill('correct horse');
  await page.getByRole('button', { name: 'Create account' }).tap();
  await expect(page.getByRole('button', { name: 'Start exploring' })).toBeVisible();

  const db = new DatabaseSync(process.env['E2E_DB_PATH']!);
  const { id } = db.prepare('SELECT id FROM users WHERE username = ?').get(name) as { id: number };
  db.prepare('INSERT INTO inventories (user_id, items, updated_at) VALUES (?, ?, 0)').run(
    id,
    JSON.stringify(stones.map((variant) => ({ kind: 'rock', variant, count: 1 }))),
  );
  db.close();

  await page.getByRole('button', { name: 'Start exploring' }).tap();
  await expect.poll(() => phase(page), { intervals: [50] }).toBe('waking');
}

async function wakeByTap(page: Page) {
  await expect(page.locator('.wake-text')).toHaveCSS('opacity', '1');
  await page.locator('.wake').tap();
  await expect.poll(() => phase(page), { intervals: [50] }).toBe('playing');
}

test('a player on an iPad plays by touch alone', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  await signUpByTouch(page, unique('tap'), ['granite']);
  await wakeByTap(page);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { exploreAudio: () => { state: string } }).exploreAudio().state,
      ),
    )
    .toBe('running');
  expect((await seen(page)).you).toMatchObject({ x: GARDEN_SPAWN.x, y: GARDEN_SPAWN.y });

  const slot = page.getByRole('button', { name: 'Slot 1, Granite' });
  await slot.tap();
  await expect(slot).toHaveAttribute('aria-pressed', 'true');

  const touch = await finger(page);
  await touch.down(await tileCentre(page, SPOT));
  await touch.move(await client(page, -20, 100));
  await touch.up(await client(page, -20, 100));
  await page.waitForTimeout(300);
  expect(await rockAt(page, SPOT)).toBeUndefined();

  const spot = await tileCentre(page, SPOT);
  await page.touchscreen.tap(spot.x, spot.y);
  await expect.poll(() => rockAt(page, SPOT)).toBeDefined();
  await expect.poll(async () => (await seen(page)).inventory).toEqual([]);

  await page.touchscreen.tap(spot.x, spot.y);
  await expect.poll(() => rockAt(page, SPOT)).toBeUndefined();
  await expect.poll(async () => (await seen(page)).inventory?.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Slot 1, Granite' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await page.getByRole('button', { name: 'Slot 1, Granite' }).tap();
  await page.touchscreen.tap(spot.x, spot.y);
  await expect.poll(() => rockAt(page, SPOT)).toBeDefined();
  const hint = page.getByRole('button', { name: /^Pick up the stone/ });
  await expect(hint).toBeVisible();
  await hint.tap();
  await expect.poll(() => rockAt(page, SPOT)).toBeUndefined();
  await expect.poll(async () => (await seen(page)).inventory?.length).toBe(1);

  const start = (await seen(page)).you!;
  await touch.down(await client(page, start.x + 4 * TILE, start.y));
  await expect.poll(async () => (await seen(page)).you!.x).toBeGreaterThan(start.x + TILE);
  const held = (await seen(page)).you!;
  expect(held.y).toBeCloseTo(start.y, 0);
  await touch.up(await client(page, start.x + 4 * TILE, start.y));
  await expect.poll(async () => (await seen(page)).you!.moving).toBe(false);
  const stopped = (await seen(page)).you!.x;
  await page.waitForTimeout(300);
  expect((await seen(page)).you!.x).toBe(stopped);

  await page.getByRole('link', { name: 'Map' }).tap();
  await expect(page).toHaveURL(/\/map$/);
  await page.getByRole('link', { name: 'Back to the game' }).tap();
  await expect(page).not.toHaveURL(/\/map$/);
  await expect(page.locator('.map-overlay')).toHaveCount(0);
  expect(await phase(page)).toBe('playing');
  expect(errors).toEqual([]);
});

test('the game fits an iPad in portrait and landscape without scrolling', async ({ page }) => {
  await signUpByTouch(page, unique('fit'), []);
  await wakeByTap(page);
  for (const [name, size] of [
    ['portrait', { width: 820, height: 1180 }],
    ['landscape', { width: 1180, height: 820 }],
  ] as const) {
    await page.setViewportSize(size);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          w: document.documentElement.scrollWidth,
          h: document.documentElement.scrollHeight,
        })),
      )
      .toEqual({ w: size.width, h: size.height });
    await expect(page.getByLabel('Game world')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.slot').last()).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `e2e/.results/ipad-${name}.png` });
  }
});
