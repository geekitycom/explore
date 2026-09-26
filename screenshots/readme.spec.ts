import { expect, test, type Browser, type Page } from '@playwright/test';
import { OVERWORLD } from '../packages/core/src/index.ts';
import { account, openForVisitors, playing, teleport, visit, worldDb } from '../e2e/helpers.ts';

const OUT = 'docs/screenshots';

/**
 * Every page's clock starts here, and each shot is taken with the clock stopped at a fixed time
 * after it, so wind, water, and butterflies look the same in every run.
 */
const START = new Date('2026-06-21T10:00:00Z').getTime();

/** Wren's world seed, picked for a lake, a wood, and a road on the screen at `BEYOND`. */
const SEED = 7;
const BEYOND = { layer: OVERWORLD, sx: 1, sy: -3 };

type Player = { username: string; name: string; address: number; look: string[] };

const WREN: Player = {
  username: 'wren',
  name: 'Wren',
  address: 1,
  look: ['Hair: long', 'Hair color: auburn', 'Shirt: purple', 'Pants: charcoal'],
};
const JUNIPER: Player = {
  username: 'juniper',
  name: 'Juniper',
  address: 2,
  look: ['Hair: spiky', 'Hair color: blonde', 'Shirt: orange', 'Pants: blue'],
};

type State = { phase: string; portals?: unknown[] };
const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { exploreState?: () => State }).exploreState?.());

/** A page on its own clock, signed up as `player` with their avatar, left on the avatar step. */
async function signUp(browser: Browser, player: Player): Promise<Page> {
  const page = await browser.newPage();
  await page.clock.install({ time: START });
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${player.address}` });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill(player.username);
  await page.getByLabel('Display name').fill(player.name);
  await page.getByLabel('Password', { exact: true }).fill('correct horse');
  await page.getByLabel('Password again').fill('correct horse');
  await page.getByRole('button', { name: 'Create account' }).click();
  for (const choice of player.look) await page.getByRole('button', { name: choice }).click();
  return page;
}

/** Stops the page's clock `seconds` after `START`, so nothing moves until `runFor` or `resume`. */
const pauseAt = (page: Page, seconds: number) => page.clock.pauseAt(START + seconds * 1000);

async function shoot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test('README screenshots', async ({ browser }) => {
  const wren = await signUp(browser, WREN);
  const world = worldDb(account(WREN.username).home);
  world.prepare('UPDATE world SET seed = ? WHERE id = 1').run(SEED);
  world.close();
  await wren.getByRole('button', { name: 'Start exploring' }).click();
  await expect.poll(async () => (await state(wren))?.phase).toBe('waking');
  await expect(wren.locator('.wake-text')).toHaveCSS('opacity', '1');
  await pauseAt(wren, 30);
  await shoot(wren, 'wake-up');

  await wren.clock.resume();
  await wren.keyboard.press('Space');
  await expect.poll(async () => (await state(wren))?.phase).toBe('playing');
  const code = await openForVisitors(wren);
  await pauseAt(wren, 60);

  const juniper = await signUp(browser, JUNIPER);
  await juniper.getByRole('button', { name: 'Start exploring' }).click();
  await playing(juniper);
  await visit(juniper, code);
  await expect.poll(async () => (await state(wren))?.portals?.length).toBe(1);
  await wren.clock.runFor(1000);
  await shoot(wren, 'portal-arrival');
  await wren.clock.runFor(2000);
  await shoot(wren, 'friends-in-the-garden');

  await juniper.close();
  await wren.clock.resume();
  await teleport(wren, WREN.username, BEYOND, { tx: 10, ty: 7 });
  await wren.evaluate(() => new Promise((drawn) => requestAnimationFrame(drawn)));
  await pauseAt(wren, 120);
  // The walking tip shows once the player has stood still for half a second of drawn frames.
  await wren.clock.runFor(1000);
  await shoot(wren, 'beyond-the-garden');
});
