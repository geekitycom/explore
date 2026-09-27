import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
import {
  closeToVisitors,
  displayNameOf,
  openForVisitors,
  playing,
  signUp,
  unique,
  visit,
} from './helpers.ts';

type Portal = { kind: string; traveller: 'you' | { name: string } };
type Snapshot = { phase: string; portals?: Portal[] };

const phase = (page: Page) =>
  page.evaluate(() => (window as unknown as { exploreState: () => Snapshot }).exploreState().phase);

/** Whether your portal home is playing, and the path the page is on while it does. */
const leaving = (page: Page) =>
  page.evaluate(() => ({
    departing: (window as unknown as { exploreState: () => Snapshot })
      .exploreState()
      .portals?.some((p) => p.kind === 'depart' && p.traveller === 'you'),
    path: location.pathname,
  }));

const hint = (page: Page) => page.locator('.hint-bar');

test('a friend joins with the code, goes home, and is sent home when the world closes', async ({
  browser,
}) => {
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [ann, ben] = await Promise.all([a.newPage(), b.newPage()]);
  const [na, nb] = [unique('ann'), unique('ben')];
  const annName = displayNameOf(na);
  await signUp(ann, na);
  await playing(ann);
  const stale = await openForVisitors(ann);
  await closeToVisitors(ann);
  const code = await openForVisitors(ann);
  await signUp(ben, nb);
  await playing(ben);

  await ben.getByRole('button', { name: 'Friends' }).click();
  const dialog = ben.getByRole('dialog', { name: 'Play with friends' });
  await dialog.getByLabel('Their code').fill(stale);
  await dialog.getByRole('button', { name: 'Go' }).click();
  await expect(dialog.getByRole('alert').filter({ hasText: /./ })).toHaveText(
    "That code doesn't open any world right now. Check it with your friend.",
  );
  await ben.screenshot({ path: 'e2e/.results/visit-refused.png' });
  await dialog.getByRole('button', { name: 'Done' }).click();

  await visit(ben, code);
  await expect(hint(ben)).toHaveText(`You arrive in ${annName}'s world.`);
  await ben.screenshot({ path: 'e2e/.results/visit-arrived.png' });

  await ben.getByRole('button', { name: 'Go home' }).first().click();
  await expect
    .poll(() => leaving(ben), { intervals: [50] })
    .toEqual({ departing: true, path: expect.stringMatching(/^\/worlds\/\d+$/) });
  await expect(ben).toHaveURL(/\/$/);
  await expect.poll(() => phase(ben)).toBe('playing');

  await visit(ben, code);
  await closeToVisitors(ann);
  await expect(ben).toHaveURL(/\/$/);
  await expect(hint(ben)).toHaveText(`${annName} closed their world, so you're back home.`);
  await expect.poll(() => phase(ben)).toBe('playing');
  await ben.screenshot({ path: 'e2e/.results/visit-sent-home.png' });
});
