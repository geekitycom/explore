import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
import { displayNameOf, playing, signUp, unique } from './helpers.ts';

type Avatar = { hairStyle: string; shirt: string };

const ownUser = (page: Page) =>
  page.evaluate(() => {
    const { displayName, avatar } = (
      window as unknown as { exploreUser: () => { displayName: string; avatar: Avatar } }
    ).exploreUser();
    return { displayName, hairStyle: avatar.hairStyle, shirt: avatar.shirt };
  });

test('a player renames and restyles from the Name & avatar dialog without reconnecting', async ({
  page,
}) => {
  let sockets = 0;
  page.on('websocket', () => sockets++);
  const name = unique('rename');
  await signUp(page, name);
  await playing(page);
  const socketsBefore = sockets;
  const who = page.locator('.game-bar .who');
  await expect(who).toHaveText(displayNameOf(name));

  await page.getByRole('button', { name: 'Name & avatar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Your name and avatar' });
  const field = dialog.getByLabel('Display name');
  await expect(field).toHaveValue(displayNameOf(name));
  await expect(dialog.getByRole('button', { name: 'Shirt: green' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  await field.fill('   ');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog.locator('#profile-name-error')).toHaveText('Enter a display name');
  await expect(dialog).toBeVisible();

  await field.fill('  Andy  ');
  await dialog.getByRole('button', { name: 'Hair: bun' }).click();
  await dialog.getByRole('button', { name: 'Shirt: purple' }).click();
  await page.screenshot({ path: 'e2e/.results/avatar-editor.png' });
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await expect(who).toHaveText('Andy');
  await expect
    .poll(() => ownUser(page))
    .toEqual({ displayName: 'Andy', hairStyle: 'bun', shirt: 'purple' });

  await page.getByRole('button', { name: 'Name & avatar' }).click();
  await expect(field).toHaveValue('Andy');
  await expect(dialog.getByRole('button', { name: 'Shirt: purple' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(sockets).toBe(socketsBefore);
});
