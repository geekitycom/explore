import { DatabaseSync } from 'node:sqlite';
import { expect, test, type Page } from '@playwright/test';
import {
  OVERWORLD,
  SCREEN_H,
  SCREEN_W,
  bare,
  featureAt,
  isWalkable,
  networkOf,
  seedEpitaph,
  type Screen,
  type ScreenCoord,
  type WorldSeed,
} from '../packages/core/src/index.ts';
import { playing, signUp, teleport, unique } from './helpers.ts';

function graveyardScreen(seed: WorldSeed): ScreenCoord {
  const poi = networkOf({ seed }, OVERWORLD)
    .poisIn({ x0: -800, y0: -600, x1: 800, y1: 600 })
    .filter((p) => p.kind === 'graveyard' || p.kind === 'burialground')
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0]!;
  return { layer: OVERWORLD, sx: Math.floor(poi.x / SCREEN_W), sy: Math.floor(poi.y / SCREEN_H) };
}

const screenOnPage = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { exploreState: () => { place: { screen: unknown } } }).exploreState()
        .place.screen,
  ) as Promise<Screen>;

test('a grave shows its epitaph in a bubble to a player who walks up to it', async ({ page }) => {
  const db = new DatabaseSync(process.env['E2E_DB_PATH']!);
  const user = unique('mourner');
  await signUp(page, user);
  await playing(page);
  await page.waitForTimeout(300);

  const { seed } = db.prepare('SELECT seed FROM world WHERE id = 1').get() as { seed: WorldSeed };
  const coord = graveyardScreen(seed);
  await teleport(page, db, user, coord, { tx: 10, ty: 7 });
  const screen = await screenOnPage(page);
  const graves = [];
  for (let ty = 1; ty < SCREEN_H - 1; ty++) {
    for (let tx = 1; tx < SCREEN_W - 1; tx++) {
      if (featureAt(screen, tx, ty) === 'grave' && isWalkable(bare(screen), tx, ty + 1))
        graves.push({ tx, ty });
    }
  }
  const grave = graves[0]!;
  await teleport(page, db, user, coord, { tx: grave.tx, ty: grave.ty + 1 });

  const bubble = page.getByRole('note');
  await expect(bubble).toHaveText(seedEpitaph({ seed }, coord, grave));
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'e2e/.results/epitaph-bubble.png' });
  db.close();
});
