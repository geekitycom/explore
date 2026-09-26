import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import { playing, signUp, unique } from './helpers.ts';

type Pose = { x: number; y: number; dir: string };
type Stone = { stone: string; by?: number };
type Seen = {
  you: Pose;
  inventory: { variant: string; count: number }[];
  rocks: { tx: number; ty: number; stack: Stone[] }[];
};

const TILE = 16;
/** Beside the garden's middle path, clear of the way other specs walk. */
const SPOT = { tx: 8, ty: 11 };

const seen = (page: Page): Promise<Seen> =>
  page.evaluate(() => {
    const state = (
      window as unknown as {
        exploreState: () => {
          you: Pose;
          inventory: Seen['inventory'];
          place: { traces: Map<string, { kind: string; tx: number; ty: number; stack: Stone[] }> };
        };
      }
    ).exploreState();
    return {
      you: state.you,
      inventory: state.inventory,
      rocks: [...state.place.traces.values()].filter((t) => t.kind === 'rock'),
    };
  });

const hint = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { exploreHud: () => { hint?: string } }).exploreHud().hint,
  );

const stackAt = async (page: Page) =>
  (await seen(page)).rocks.find((r) => r.tx === SPOT.tx && r.ty === SPOT.ty)?.stack;

/** Nothing in play hands out stones in the garden, so the test fills the pockets directly. */
async function give(page: Page, stones: string[]) {
  const id = await page.evaluate(
    () => (window as unknown as { exploreUser: () => { id: number } }).exploreUser().id,
  );
  const db = new DatabaseSync(process.env['E2E_DB_PATH']!);
  db.prepare(
    `INSERT INTO inventories (user_id, items, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET items = excluded.items, updated_at = excluded.updated_at`,
  ).run(id, JSON.stringify(stones.map((variant) => ({ kind: 'rock', variant, count: 1 }))), 0);
  db.close();
  await page.reload();
  await playing(page);
}

/** Walks along the garden's row 12 to the spot's column, then faces it. */
async function faceSpot(page: Page) {
  const target = SPOT.tx * TILE + TILE / 2;
  const { you } = await seen(page);
  const key = you.x > target ? 'ArrowLeft' : 'ArrowRight';
  await page.keyboard.down(key);
  await expect
    .poll(async () => Math.abs((await seen(page)).you.x - target) < 4, { intervals: [10] })
    .toBe(true);
  await page.keyboard.up(key);
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await seen(page)).you.dir, { intervals: [10] }).toBe('n');
  await page.keyboard.up('ArrowUp');
  const { x, y } = (await seen(page)).you;
  expect(Math.floor(x / TILE)).toBe(SPOT.tx);
  expect(Math.floor((y - 1.5) / TILE)).toBe(SPOT.ty + 1);
}

test('stones are picked up, carried, put down and stacked into a cairn', async ({ page }) => {
  await signUp(page, unique('cairn'));
  await playing(page);
  await give(page, ['granite', 'sand', 'stone']);
  await faceSpot(page);
  await page.screenshot({ path: 'e2e/.results/cairn-stones-in-bar.png' });

  await page.keyboard.press('Digit1');
  await expect.poll(() => stackAt(page)).toEqual([{ stone: 'granite', by: expect.any(Number) }]);
  await expect.poll(() => hint(page)).toContain('Pick up the stone');
  await page.screenshot({ path: 'e2e/.results/cairn-pick-up.png' });

  await page.keyboard.press('KeyE');
  await expect.poll(() => stackAt(page)).toBeUndefined();
  expect((await seen(page)).inventory.map((s) => s.variant)).toEqual(['sand', 'stone', 'granite']);

  for (let n = 1; n <= 3; n++) {
    await page.keyboard.press('Digit1');
    await expect.poll(async () => (await stackAt(page))?.length).toBe(n);
  }
  await give(page, ['granite', 'sand', 'stone']);
  await faceSpot(page);
  for (let n = 4; n <= 6; n++) {
    await page.keyboard.press('Digit1');
    await expect.poll(async () => (await stackAt(page))?.length).toBe(n);
  }
  expect((await stackAt(page))!.map((s) => s.stone)).toEqual([
    'sand',
    'stone',
    'granite',
    'granite',
    'sand',
    'stone',
  ]);
  expect((await seen(page)).inventory).toEqual([]);

  await page.keyboard.press('KeyE');
  await expect.poll(() => hint(page)).toContain('Stones in a cairn stay put.');

  await page.keyboard.down('ArrowRight');
  await expect
    .poll(async () => (await seen(page)).you.x >= (SPOT.tx + 1) * TILE + 10, { intervals: [10] })
    .toBe(true);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'e2e/.results/cairn-mixed.png' });
  await page
    .getByLabel('Game world')
    .screenshot({ path: 'e2e/.results/cairn-mixed-view.png', scale: 'css' });
});
