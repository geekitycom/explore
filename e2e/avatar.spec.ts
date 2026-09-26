import { expect, test, type Page } from '@playwright/test';
import { displayNameOf, playing, signUp, unique } from './helpers.ts';

type Avatar = { hairStyle: string; shirt: string };
type Snapshot = {
  phase: string;
  others?: Map<number, { name: string; avatar: Avatar }>;
};

async function enter(page: Page, name: string) {
  await signUp(page, name);
  await playing(page);
}

const ownAvatar = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { exploreUser: () => { avatar: Avatar } }).exploreUser().avatar,
  );

const ownDisplayName = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { exploreUser: () => { displayName: string } }).exploreUser()
        .displayName,
  );

const othersAvatars = (page: Page) =>
  page.evaluate(() =>
    [
      ...((window as unknown as { exploreState: () => Snapshot }).exploreState().others?.values() ??
        []),
    ].map(({ name, avatar }) => ({ name, hairStyle: avatar.hairStyle, shirt: avatar.shirt })),
  );

// Two accounts cannot share a world until TASK-64.3 opens worlds to visitors: restored by TASK-64.3.
test.fixme('a player renames and restyles in game and others on the screen see it live', async ({
  browser,
}) => {
  const [a, b] = await Promise.all([browser.newContext(), browser.newContext()]);
  const [pa, pb] = await Promise.all([a.newPage(), b.newPage()]);
  let benSockets = 0;
  pb.on('websocket', () => benSockets++);
  const [na, nb] = [unique('ann'), unique('ben')];
  await enter(pa, na);
  await enter(pb, nb);
  await expect
    .poll(() => othersAvatars(pb))
    .toEqual([{ name: displayNameOf(na), hairStyle: 'spiky', shirt: 'green' }]);

  await pa.getByRole('button', { name: 'Name & avatar' }).click();
  const dialog = pa.getByRole('dialog', { name: 'Your name and avatar' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Shirt: green' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByLabel('Display name').fill('Annie');
  await dialog.getByRole('button', { name: 'Hair: bun' }).click();
  await dialog.getByRole('button', { name: 'Shirt: purple' }).click();
  await pa.screenshot({ path: 'e2e/.results/avatar-editor.png' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();

  expect(await ownAvatar(pa)).toMatchObject({ hairStyle: 'bun', shirt: 'purple' });
  await expect
    .poll(() => othersAvatars(pb))
    .toEqual([{ name: 'Annie', hairStyle: 'bun', shirt: 'purple' }]);
  expect(benSockets).toBe(1);
  await pb.screenshot({ path: 'e2e/.results/avatar-seen-by-other.png' });

  await pa.getByRole('button', { name: 'Log out' }).click();
  await pa.getByLabel('Username').fill(na);
  await pa.getByLabel('Password').fill('correct horse');
  await pa.getByRole('button', { name: 'Log in' }).click();
  await pa.getByRole('button', { name: 'Name & avatar' }).click();
  await expect(dialog.getByLabel('Display name')).toHaveValue('Annie');
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

test('a player renames themselves from the game bar and keeps the name', async ({ page }) => {
  const name = unique('rename');
  await enter(page, name);
  const who = page.locator('.game-bar .who');
  await expect(who).toHaveText(displayNameOf(name));

  await page.getByRole('button', { name: 'Name & avatar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Your name and avatar' });
  const field = dialog.getByLabel('Display name');
  await expect(field).toHaveValue(displayNameOf(name));
  await field.fill('   ');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.locator('#profile-name-error')).toHaveText('Enter a display name');
  await expect(dialog).toBeVisible();

  await field.fill('  Andy  ');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(who).toHaveText('Andy');
  expect(await ownDisplayName(page)).toBe('Andy');

  await page.reload();
  await playing(page);
  await expect(who).toHaveText('Andy');
});
