import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import {
  OVERWORLD,
  bare,
  inArea,
  isWalkable,
  landmarkOn,
  type Area,
  type Screen,
  type ScreenCoord,
  type WorldSeed,
} from '../packages/core/src/index.ts';
import { playing, signUp, teleport, unique } from './helpers.ts';

type Hud = { hint: string | undefined };
type Site = { tx: number; ty: number; area: Area };

const hud = (page: Page) =>
  page.evaluate(() => (window as unknown as { exploreHud: () => Hud }).exploreHud());

/** The screen and its landmark trace, as the page holds them. */
const siteOnPage = (page: Page) =>
  page.evaluate(() => {
    const { place } = (
      window as unknown as {
        exploreState: () => { place: { screen: unknown; traces: Map<string, { kind: string }> } };
      }
    ).exploreState();
    const site = [...place.traces.values()].find((t) => t.kind === 'landmark');
    return { screen: place.screen, site };
  }) as Promise<{ screen: Screen; site: Site | undefined }>;

function landmarkScreen(seed: WorldSeed): ScreenCoord {
  for (let r = 1; r < 20; r++) {
    for (let sy = -r; sy <= r; sy++) {
      for (let sx = -r; sx <= r; sx++) {
        const coord = { layer: OVERWORLD, sx, sy };
        if (Math.max(Math.abs(sx), Math.abs(sy)) === r && landmarkOn({ seed }, coord)) return coord;
      }
    }
  }
  throw new Error('no landmark near the garden');
}

test('the first to reach a landmark names it for everyone and the map', async ({ page }) => {
  const db = new DatabaseSync(process.env['E2E_DB_PATH']!);
  const user = unique('namer');
  await signUp(page, user);
  await playing(page);
  await page.waitForTimeout(300);

  const { seed } = db.prepare('SELECT seed FROM world WHERE id = 1').get() as { seed: WorldSeed };
  const coord = landmarkScreen(seed);
  await teleport(page, db, user, coord, { tx: 10, ty: 7 });
  const { screen, site } = await siteOnPage(page);
  expect(site).toBeDefined();
  const { tx, ty, area } = site!;
  const stand = [
    { tx, ty: ty + 1 },
    { tx, ty: ty - 1 },
    { tx: tx + 1, ty },
    { tx: tx - 1, ty },
  ].find((t) => isWalkable(bare(screen), t.tx, t.ty) && inArea(area, t))!;
  await teleport(page, db, user, coord, stand);

  await expect.poll(async () => (await hud(page)).hint).toBe('Name this place');
  await page.keyboard.press('KeyE');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText(/^Name this /);
  await dialog.getByLabel('Name').fill('Hare Stones');
  await expect(dialog.getByText('11/30')).toBeVisible();
  await dialog.getByLabel(/A line for travellers/).fill('Where the hares run at dusk');
  await expect(dialog.getByText('27/80')).toBeVisible();
  await page.screenshot({ path: 'e2e/.results/landmark-dialog.png' });

  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  const bubble = page.getByRole('note');
  await expect(bubble).toContainText('Hare Stones');
  await expect(bubble).toContainText('Where the hares run at dusk');
  await expect(bubble).toContainText(`named by ${user}`);
  await expect(bubble.getByRole('button', { name: 'Edit' })).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'e2e/.results/landmark-bubble.png' });

  await page.getByRole('link', { name: 'Map' }).click();
  await expect(page.getByLabel(/^World map with/)).toBeVisible();
  const names = await page.evaluate(
    () =>
      (window as unknown as { exploreMap: () => { names: { name: string }[] } }).exploreMap().names,
  );
  expect(names.map((n) => n.name)).toContain('Hare Stones');
  await page.getByLabel(/^World map with/).press('0');
  for (let i = 0; i < 4; i++) await page.getByLabel(/^World map with/).press('+');
  await page.screenshot({ path: 'e2e/.results/landmark-map.png' });
  db.close();
});
