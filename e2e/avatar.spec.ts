import { expect, test, type Page } from '@playwright/test';

type Avatar = { hairStyle: string; shirt: string };
type Snapshot = {
  phase: string;
  others?: Map<number, { name: string; avatar: Avatar }>;
};

const unique = (tag: string) =>
  `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

async function signUp(page: Page, name: string) {
  await page.goto('/');
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForFunction(
    () =>
      (window as unknown as { exploreState?: () => Snapshot }).exploreState?.().phase === 'playing',
  );
}

const ownAvatar = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { exploreUser: () => { avatar: Avatar } }).exploreUser().avatar,
  );

const othersAvatars = (page: Page) =>
  page.evaluate(() =>
    [
      ...((window as unknown as { exploreState: () => Snapshot }).exploreState().others?.values() ??
        []),
    ].map(({ name, avatar }) => ({ name, hairStyle: avatar.hairStyle, shirt: avatar.shirt })),
  );

test('a player restyles in game and others on the screen see it live', async ({ browser }) => {
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pa, pb] = await Promise.all([a.newPage(), b.newPage()]);
  let benSockets = 0;
  pb.on('websocket', () => benSockets++);
  const [na, nb] = [unique('ann'), unique('ben')];
  await signUp(pa, na);
  await signUp(pb, nb);
  await expect
    .poll(() => othersAvatars(pb))
    .toEqual([{ name: na, hairStyle: 'spiky', shirt: 'green' }]);

  await pa.getByRole('button', { name: 'Avatar' }).click();
  const dialog = pa.getByRole('dialog', { name: 'Your avatar' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Shirt: green' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: 'Hair: bun' }).click();
  await dialog.getByRole('button', { name: 'Shirt: purple' }).click();
  await pa.screenshot({ path: 'e2e/.results/avatar-editor.png' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  expect(await ownAvatar(pa)).toMatchObject({ hairStyle: 'bun', shirt: 'purple' });
  await expect
    .poll(() => othersAvatars(pb))
    .toEqual([{ name: na, hairStyle: 'bun', shirt: 'purple' }]);
  expect(benSockets).toBe(1);
  await pb.screenshot({ path: 'e2e/.results/avatar-seen-by-other.png' });

  await pa.getByRole('button', { name: 'Log out' }).click();
  await pa.getByRole('button', { name: 'Log in' }).click();
  await pa.getByLabel('Username').fill(na);
  await pa.getByLabel('Password').fill('correct horse');
  await pa.getByRole('button', { name: 'Log in' }).click();
  await pa.getByRole('button', { name: 'Avatar' }).click();
  await expect(dialog.getByRole('button', { name: 'Shirt: purple' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(dialog.getByRole('button', { name: 'Hair: bun' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await ownAvatar(pa)).toMatchObject({ hairStyle: 'bun', shirt: 'purple' });

  await a.close();
  await b.close();
});
