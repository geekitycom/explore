import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
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
import { account, playing, signUp, standingStill, teleport, unique, worldDb } from './helpers.ts';

function graveyardScreen(seed: WorldSeed): ScreenCoord {
  const poi = networkOf({ seed }, OVERWORLD)
    .poisIn({ x0: -800, y0: -600, x1: 800, y1: 600 })
    .filter((p) => p.kind === 'graveyard' || p.kind === 'burialground')
    .sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y))[0]!;
  return { layer: OVERWORLD, sx: Math.floor(poi.x / SCREEN_W), sy: Math.floor(poi.y / SCREEN_H) };
}

type Tile = { tx: number; ty: number };

/** The screen as the page holds it, and where its landmark's signpost stands, if it has one. */
const screenOnPage = (page: Page) =>
  page.evaluate(() => {
    const { place } = (
      window as unknown as {
        exploreState: () => {
          place: { screen: unknown; traces: Map<string, { kind: string; tx: number; ty: number }> };
        };
      }
    ).exploreState();
    const post = [...place.traces.values()].find((t) => t.kind === 'landmark');
    return { screen: place.screen, post: post && { tx: post.tx, ty: post.ty } };
  }) as Promise<{ screen: Screen; post: Tile | undefined }>;

const TILE = 16;

/** Holds an arrow key until the player faces that way; a grave in the way keeps them still. */
async function face(page: Page, key: string, dir: string) {
  await page.keyboard.down(key);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { exploreState: () => { you: { dir: string } } }).exploreState()
              .you.dir,
        ),
      { intervals: [10] },
    )
    .toBe(dir);
  await page.keyboard.up(key);
}

/** The bubble sits on the given side of the grave's tile, spanning the tile's centre. */
async function expectBeside(page: Page, grave: { tx: number; ty: number }, side: string) {
  const bubble = page.getByRole('note');
  await expect(bubble).toHaveClass(new RegExp(`bubble-${side}`));
  const world = (await page.locator('canvas').boundingBox())!;
  const scale = world.width / (SCREEN_W * TILE);
  const box = (await bubble.boundingBox())!;
  const centre = world.x + (grave.tx + 0.5) * TILE * scale;
  expect(box.x).toBeLessThan(centre);
  expect(box.x + box.width).toBeGreaterThan(centre);
  const edge = world.y + (side === 'above' ? grave.ty : grave.ty + 1) * TILE * scale;
  const gap = side === 'above' ? edge - (box.y + box.height) : box.y - edge;
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(TILE * scale);
}

test('a grave speaks to a player facing it, its bubble beside it', async ({ page }) => {
  const user = unique('mourner');
  await signUp(page, user);
  const db = worldDb(account(user).home);
  await playing(page);

  const { seed } = db.prepare('SELECT seed FROM world WHERE id = 1').get() as { seed: WorldSeed };
  const coord = graveyardScreen(seed);
  await teleport(page, user, coord, { tx: 10, ty: 7 });
  const { screen, post } = await screenOnPage(page);
  const open = (tx: number, ty: number) =>
    isWalkable(bare(screen), tx, ty) && !(tx === post?.tx && ty === post.ty);
  const grave = (() => {
    for (let ty = 3; ty < SCREEN_H - 3; ty++)
      for (let tx = 2; tx < SCREEN_W - 2; tx++)
        if (
          featureAt(screen, tx, ty) === 'grave' &&
          open(tx, ty - 1) &&
          open(tx, ty + 1) &&
          open(tx - 1, ty) &&
          featureAt(screen, tx - 1, ty - 1) !== 'grave'
        )
          return { tx, ty };
    throw new Error('no grave open above, below and to its left');
  })();
  const { name } = JSON.parse(
    (
      db
        .prepare(
          `SELECT data FROM traces
           WHERE kind = 'epitaph' AND layer = ? AND sx = ? AND sy = ? AND tx = ? AND ty = ?`,
        )
        .get(coord.layer, coord.sx, coord.sy, grave.tx, grave.ty) as { data: string }
    ).data,
  ) as { name: string };
  const words = seedEpitaph({ seed }, coord, { ...grave, name });
  const bubble = page.getByRole('note');

  await teleport(page, user, coord, { tx: grave.tx - 1, ty: grave.ty });
  await expect(bubble.filter({ hasText: words })).toHaveCount(0);
  await face(page, 'ArrowRight', 'e');
  await expect(bubble).toHaveText(words);
  await expectBeside(page, grave, 'below');
  await standingStill(page);
  await page.screenshot({ path: 'e2e/.results/epitaph-beside.png' });

  await teleport(page, user, coord, { tx: grave.tx, ty: grave.ty + 1 });
  await expect(bubble).toHaveText(words);
  await expectBeside(page, grave, 'above');
  await standingStill(page);
  await page.screenshot({ path: 'e2e/.results/epitaph-below.png' });

  await teleport(page, user, coord, { tx: grave.tx, ty: grave.ty - 1 });
  await face(page, 'ArrowDown', 's');
  await expect(bubble).toHaveText(words);
  await expectBeside(page, grave, 'below');
  await standingStill(page);
  await page.screenshot({ path: 'e2e/.results/epitaph-above.png' });
  db.close();
});
