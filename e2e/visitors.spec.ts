import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  closeToVisitors,
  displayNameOf,
  openForVisitors,
  playing,
  signUp,
  unique,
  visit,
} from './helpers.ts';

type Snapshot = {
  phase: string;
  you?: { x: number; y: number };
  others?: Map<number, { name: string }>;
};
type Where = { here: number; home: number; visiting: boolean; hostName?: string };
type MapPlayers = { players: { name: string; you: boolean }[] };

const snapshot = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { exploreState: () => Snapshot }).exploreState();
    return {
      phase: s.phase,
      you: s.you && { x: s.you.x, y: s.you.y },
      others: [...(s.others?.values() ?? [])].map(({ name }) => name),
    };
  });

const where = (page: Page) =>
  page.evaluate(() => (window as unknown as { exploreWorld: () => Where }).exploreWorld());

const mapPlayers = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { exploreMap: () => MapPlayers })
      .exploreMap()
      .players.map(({ name, you }) => `${name}${you ? ' (you)' : ''}`)
      .sort(),
  );

const hint = (page: Page) => page.locator('.hint-bar');

async function enter(page: Page, name: string) {
  await signUp(page, name);
  await playing(page);
}

/** Ann at home with her world open, Ben at home holding her code. */
async function annAndBen(browser: Browser) {
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [ann, ben] = await Promise.all([a.newPage(), b.newPage()]);
  const [na, nb] = [unique('ann'), unique('ben')];
  await enter(ann, na);
  const code = await openForVisitors(ann);
  await enter(ben, nb);
  return { ann, ben, code, annName: displayNameOf(na), benName: displayNameOf(nb) };
}

async function expectHome(page: Page, notice: string) {
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => where(page)).toMatchObject({ visiting: false });
  await expect(hint(page)).toHaveText(notice);
  await expect.poll(async () => (await snapshot(page)).phase).toBe('playing');
}

test('a friend joins with the code, both see each other on the map, and going home resumes in place', async ({
  browser,
}) => {
  const { ann, ben, code, annName, benName } = await annAndBen(browser);
  await ben.keyboard.down('ArrowRight');
  await ben.waitForTimeout(400);
  await ben.keyboard.up('ArrowRight');
  await ben.waitForTimeout(300);
  const stoodAtHome = (await snapshot(ben)).you;

  await visit(ben, code);
  expect(await where(ben)).toMatchObject({ visiting: true, hostName: annName });
  await expect(hint(ben)).toHaveText(`You arrive in ${annName}'s world.`);
  await expect.poll(async () => (await snapshot(ann)).others).toEqual([benName]);
  expect((await snapshot(ben)).others).toEqual([annName]);
  await ben.screenshot({ path: 'e2e/.results/visit-arrived.png' });

  await ben.getByRole('link', { name: 'Map' }).click();
  await expect(ben).toHaveURL(/\/worlds\/\d+\/map$/);
  await expect(ben.getByLabel(/^World map with/)).toBeVisible();
  await expect.poll(() => mapPlayers(ben)).toEqual([annName, `${benName} (you)`].sort());
  await ben.screenshot({ path: 'e2e/.results/visit-map.png' });
  await ben.getByRole('link', { name: 'Back to the game' }).click();
  await playing(ben);

  await ann.getByRole('link', { name: 'Map' }).click();
  await expect(ann.getByLabel(/^World map with/)).toBeVisible();
  await expect.poll(() => mapPlayers(ann)).toEqual([`${annName} (you)`, benName].sort());
  await ann.getByRole('link', { name: 'Back to the game' }).click();

  await ben.getByRole('button', { name: 'Go home' }).click();
  await expect(ben).toHaveURL(/\/$/);
  await expect.poll(async () => (await snapshot(ben)).phase).toBe('playing');
  expect(await where(ben)).toMatchObject({ visiting: false });
  expect((await snapshot(ben)).you).toEqual(stoodAtHome);
  await expect(ben.locator('.wake')).toHaveCount(0);
  await expect.poll(async () => (await snapshot(ann)).others).toEqual([]);
});

test('a code from an earlier opening stops working once the world is reopened', async ({
  browser,
}) => {
  const { ann, ben, code: first } = await annAndBen(browser);
  await closeToVisitors(ann);
  const second = await openForVisitors(ann);
  expect(second).not.toBe(first);

  await ben.getByRole('button', { name: 'Friends' }).click();
  const dialog = ben.getByRole('dialog', { name: 'Play with friends' });
  await dialog.getByLabel('Their code').fill(first);
  await dialog.getByRole('button', { name: 'Go' }).click();
  await expect(dialog.getByRole('alert').filter({ hasText: /./ })).toHaveText(
    "That code doesn't open any world right now. Check it with your friend.",
  );
  await ben.screenshot({ path: 'e2e/.results/visit-refused.png' });
  await dialog.getByLabel('Their code').fill(second.toLowerCase());
  await dialog.getByRole('button', { name: 'Go' }).click();
  await expect(dialog).toBeHidden();
  await playing(ben);
  expect(await where(ben)).toMatchObject({ visiting: true });
});

test('closing the world sends every visitor home with a message', async ({ browser }) => {
  const { ann, ben, code, annName } = await annAndBen(browser);
  await visit(ben, code);
  await expect.poll(async () => (await snapshot(ann)).others).toHaveLength(1);

  await closeToVisitors(ann);
  await expectHome(ben, `${annName} closed their world, so you're back home.`);
  await ben.screenshot({ path: 'e2e/.results/visit-sent-home.png' });
  await expect.poll(async () => (await snapshot(ann)).others).toEqual([]);
});

test('logging out sends visitors home', async ({ browser }) => {
  const { ann, ben, code, annName } = await annAndBen(browser);
  await visit(ben, code);
  await expect.poll(async () => (await snapshot(ann)).others).toHaveLength(1);

  await ann.getByRole('button', { name: 'Log out' }).click();
  await expect(ann.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expectHome(ben, `${annName} closed their world, so you're back home.`);
});
