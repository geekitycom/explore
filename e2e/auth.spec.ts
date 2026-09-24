import { expect, test } from '@playwright/test';

const unique = () => `e2e${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test('a visitor signs up with a custom avatar, logs out, and logs back in', async ({ page }) => {
  const name = unique();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Geekity Explore' })).toBeVisible();

  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Shirt: purple' }).click();
  await page.getByRole('button', { name: 'Hair color: teal' }).click();
  await expect(page.getByRole('button', { name: 'Shirt: purple' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.screenshot({ path: 'e2e/.results/signup.png', fullPage: true });
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  const me = (await (await page.request.get('/api/me')).json()) as {
    user: { avatar: { shirt: string; hairColor: string } };
  };
  expect(me.user.avatar).toMatchObject({ shirt: 'purple', hairColor: 'teal' });

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByLabel('Username').fill(name.toUpperCase());
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});

test('server validation errors appear next to the field', async ({ page }) => {
  const name = unique();
  await page.request.post('/api/signup', {
    data: {
      username: name,
      password: 'correct horse',
      avatar: { skin: 'tan', hairStyle: 'spiky', hairColor: 'black', shirt: 'red', pants: 'blue' },
    },
  });
  await page.context().clearCookies();
  await page.goto('/');

  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#password-error')).toContainText('at least 8');

  await page.getByLabel('Password').fill('long enough pw');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#username-error')).toHaveText('That username is taken');

  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('wrong password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('.form-error')).toHaveText('Wrong username or password');
});
