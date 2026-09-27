import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
import {
  displayNameOf,
  openForVisitors,
  playing,
  signUp,
  standingStill,
  unique,
  visit,
} from './helpers.ts';

type Snapshot = {
  phase: string;
  place?: { screen: { coord: { layer: string; sx: number; sy: number } } };
  you?: { x: number; y: number };
  others?: Map<number, { name: string; x: number; y: number }>;
};

async function enter(page: Page, name: string) {
  await signUp(page, name);
  await expect(page.getByLabel('Game world')).toBeVisible();
  await playing(page);
}

const snapshot = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { exploreState: () => Snapshot }).exploreState();
    return {
      phase: s.phase,
      coord: s.place?.screen.coord,
      you: s.you,
      others: [...(s.others?.values() ?? [])].map(({ name, x, y }) => ({ name, x, y })),
    };
  });

test('two players in the garden see each other walk', async ({ browser }) => {
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pa, pb] = await Promise.all([a.newPage(), b.newPage()]);
  const [na, nb] = [unique('ann'), unique('ben')];
  await enter(pa, na);
  const code = await openForVisitors(pa);
  await enter(pb, nb);
  await visit(pb, code);

  await expect
    .poll(async () => (await snapshot(pa)).others.map((o) => o.name))
    .toEqual([displayNameOf(nb)]);
  await expect
    .poll(async () => (await snapshot(pb)).others.map((o) => o.name))
    .toEqual([displayNameOf(na)]);

  const before = (await snapshot(pb)).others[0]!;
  await pa.bringToFront();
  await pa.keyboard.down('ArrowLeft');
  await expect.poll(async () => (await snapshot(pb)).others[0]!.x).toBeLessThan(before.x - 20);
  await pa.keyboard.up('ArrowLeft');
  await standingStill(pa);
  await pa.screenshot({ path: 'e2e/.results/garden-ann.png' });
  await pb.screenshot({ path: 'e2e/.results/garden-ben.png' });

  await a.close();
  await expect.poll(async () => (await snapshot(pb)).others).toEqual([]);
  await b.close();
});

test('walking off an edge opens a new screen that matches on return', async ({ page }) => {
  await enter(page, unique('cat'));
  expect((await snapshot(page)).coord).toEqual({ layer: 'overworld', sx: 0, sy: 0 });

  await page.keyboard.down('ArrowDown');
  await expect
    .poll(async () => (await snapshot(page)).coord, { intervals: [20] })
    .toEqual({ layer: 'overworld', sx: 0, sy: 1 });
  await page.keyboard.up('ArrowDown');
  const arrived = await snapshot(page);
  expect(arrived.you!.y).toBeLessThan(24);
  await standingStill(page);
  await page.screenshot({ path: 'e2e/.results/south-of-garden.png' });

  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => (await snapshot(page)).coord, { intervals: [20] })
    .toEqual({ layer: 'overworld', sx: 0, sy: 0 });
  await page.keyboard.up('ArrowUp');
  expect((await snapshot(page)).you!.y).toBeGreaterThan(200);
});

test('a travel the server never answers returns you to play where you stood', async ({ page }) => {
  await page.routeWebSocket(/\/ws\/worlds\//, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      if (!String(message).includes('"t":"travel"')) server.send(message);
    });
  });
  await enter(page, unique('dan'));

  await page.keyboard.down('ArrowDown');
  await expect
    .poll(async () => (await snapshot(page)).phase, { intervals: [20] })
    .toBe('travelling');
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await snapshot(page)).phase, { timeout: 10_000 }).toBe('playing');
  expect((await snapshot(page)).coord).toEqual({ layer: 'overworld', sx: 0, sy: 0 });
});
