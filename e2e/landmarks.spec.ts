import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
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
import {
  account,
  displayNameOf,
  playing,
  signUp,
  standingStill,
  teleport,
  unique,
  worldDb,
} from './helpers.ts';
import { BREAK, LINE, NAMES } from './llm-stub.ts';

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

/**
 * Signs up a new player and stands them beside the signpost of the landmark nearest home, facing
 * it, so nothing on the faced tile takes the hint bar.
 */
async function besideSignpost(page: Page, user: string) {
  await signUp(page, user);
  const db = worldDb(account(user).home);
  await playing(page);
  const { seed } = db.prepare('SELECT seed FROM world WHERE id = 1').get() as { seed: WorldSeed };
  db.close();
  const coord = landmarkScreen(seed);
  await teleport(page, user, coord, { tx: 10, ty: 7 });
  const { screen, site } = await siteOnPage(page);
  expect(site).toBeDefined();
  const { tx, ty, area } = site!;
  const stands = [
    { tx, ty: ty + 1, key: 'ArrowUp', dir: 'n' },
    { tx, ty: ty - 1, key: 'ArrowDown', dir: 's' },
    { tx: tx + 1, ty, key: 'ArrowLeft', dir: 'w' },
    { tx: tx - 1, ty, key: 'ArrowRight', dir: 'e' },
  ];
  const stand = stands.find((t) => isWalkable(bare(screen), t.tx, t.ty) && inArea(area, t))!;
  await teleport(page, user, coord, stand);
  await page.keyboard.down(stand.key);
  await expect.poll(() => facing(page), { intervals: [10] }).toBe(stand.dir);
  await page.keyboard.up(stand.key);
}

const facing = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { exploreState: () => { you: { dir: string } } }).exploreState().you
        .dir,
  );

const SHOTS = 'e2e/.results';

test('a landmark carries a name from the first visit, and anyone may rename it or put it back', async ({
  page,
}) => {
  const user = unique('namer');
  await besideSignpost(page, user);
  const namedBy = `named by ${displayNameOf(user)}`;

  const bubble = page.getByRole('note');
  await expect(bubble).toBeVisible();
  await expect(bubble).not.toContainText('named by');
  await expect(bubble).toContainText(NAMES[0]!);
  await expect(bubble).toContainText(LINE);
  await expect(bubble.getByRole('button', { name: 'Report' })).toHaveCount(0);
  await standingStill(page);
  await page.screenshot({ path: `${SHOTS}/landmark-generated.png` });

  await expect.poll(async () => (await hud(page)).hint).toBe('Rename this place');
  await page.keyboard.press('KeyE');
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading')).toHaveText(/^Rename this /);
  await expect(dialog.getByText('The land gave it this name.')).toBeVisible();
  await expect(dialog.getByLabel('Name')).toHaveValue(NAMES[0]!);
  await expect(dialog.getByLabel(/A line for travellers/)).toHaveValue(LINE);
  const suggest = dialog.getByRole('button', { name: 'Suggest a name' });
  await page.screenshot({ path: `${SHOTS}/landmark-dialog.png` });

  await suggest.click();
  await expect(suggest).toHaveAttribute('aria-busy', 'true');
  await expect(dialog.getByLabel('Name')).toHaveValue(NAMES[1]!);
  await expect(suggest).toHaveAttribute('aria-busy', 'false');
  await expect(bubble).toContainText(NAMES[0]!);
  await page.screenshot({ path: `${SHOTS}/landmark-suggested.png` });
  await suggest.click();
  await expect(dialog.getByLabel('Name')).toHaveValue(NAMES[2]!);

  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(bubble).toContainText(NAMES[2]!);
  await expect(bubble).toContainText(namedBy);
  await standingStill(page);
  await page.screenshot({ path: `${SHOTS}/landmark-renamed.png` });

  await bubble.getByRole('button', { name: 'Rename' }).click();
  await expect(dialog.getByText(`Named by ${displayNameOf(user)}.`)).toBeVisible();
  await dialog.getByRole('button', { name: "Use the land's name" }).click();
  await expect(dialog).toBeHidden();
  await expect(bubble).toContainText(NAMES[0]!);
  await expect(bubble).not.toContainText('named by');

  await page.keyboard.press('KeyE');
  await dialog.getByLabel('Name').fill('Hare Stones');
  await expect(dialog.getByText('11/30')).toBeVisible();
  await dialog.getByLabel(/A line for travellers/).fill('Where the hares run at dusk');
  await expect(dialog.getByText('27/80')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(bubble).toContainText('Hare Stones');
  await expect(bubble).toContainText('Where the hares run at dusk');
  await expect(bubble).toContainText(namedBy);

  await page.getByRole('link', { name: 'Map' }).click();
  await expect(page.getByLabel(/^World map with/)).toBeVisible();
  const names = await page.evaluate(
    () =>
      (window as unknown as { exploreMap: () => { names: { name: string }[] } }).exploreMap().names,
  );
  expect(names.map((n) => n.name)).toContain('Hare Stones');
  await page.getByLabel(/^World map with/).press('0');
  for (let i = 0; i < 4; i++) await page.getByLabel(/^World map with/).press('+');
  await page.screenshot({ path: `${SHOTS}/landmark-map.png` });
});

test('a failed suggestion leaves the fields alone, and a seventh in five minutes is refused', async ({
  page,
}) => {
  const user = unique('asker');
  await besideSignpost(page, user);
  const bubble = page.getByRole('note');
  await expect(bubble).toContainText(NAMES[0]!);

  await page.keyboard.press('KeyE');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(BREAK);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(bubble).toContainText(BREAK);

  await bubble.getByRole('button', { name: 'Rename' }).click();
  await dialog.getByLabel('Name').fill('Half Typed');
  const suggest = dialog.getByRole('button', { name: 'Suggest a name' });
  for (let i = 0; i < 6; i++) {
    await suggest.click();
    await expect(dialog.getByRole('alert')).toHaveText('No name came to mind. Try again.');
    await expect(suggest).toBeEnabled();
    await expect(dialog.getByLabel('Name')).toHaveValue('Half Typed');
  }
  await suggest.click();
  await expect(dialog.getByRole('alert')).toHaveText(
    'That is plenty of new names for now. Try again in 5 min.',
  );
  await expect(dialog.getByLabel('Name')).toHaveValue('Half Typed');
  await expect(bubble).toContainText(BREAK);
});
