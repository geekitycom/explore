import { expect, test } from './test.ts';
import { createAccount, displayNameOf, playing, signUp, unique } from './helpers.ts';

type Me = { user: { avatar: { shirt: string; hairColor: string }; avatarChosen: boolean } };

test('a logged-out visitor lands on login, on the site and on /map', async ({ page }) => {
  for (const path of ['/', '/map']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Geekity Explore' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.getByLabel('Password again')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create an account' })).toBeVisible();
  }
  await expect(page.locator('main.auth')).toHaveCSS('background-image', 'none');
  await page.screenshot({ path: 'e2e/.results/login.png', fullPage: true });
});

test('the create-account screen catches a mistyped password before submitting', async ({
  page,
}) => {
  let signups = 0;
  page.on('request', (req) => {
    if (req.url().endsWith('/api/signup')) signups++;
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await expect(page.locator('main.auth')).not.toHaveCSS('background-image', 'none');
  await page.screenshot({ path: 'e2e/.results/create-account.png', fullPage: true });

  await createAccount(page, unique('typo'), { retyped: 'correct horsf' });
  await expect(page.locator('#password-again-error')).toHaveText("The passwords don't match");
  await expect(page.getByLabel('Password again')).toBeFocused();
  expect(signups).toBe(0);
  await page.screenshot({ path: 'e2e/.results/create-account-mismatch.png', fullPage: true });
});

test('a new player gets the avatar step until they choose one, then enters the game', async ({
  page,
}) => {
  const name = unique('new');
  const step = page.getByRole('heading', { name: 'Choose your avatar' });
  await createAccount(page, name);
  await expect(step).toBeVisible();
  await expect(page.locator('.tagline')).toContainText(`see you, ${displayNameOf(name)}.`);

  await page.reload();
  await expect(step).toBeVisible();

  await page.context().clearCookies();
  await page.goto('/map');
  await page.getByLabel('Username').fill(name.toUpperCase());
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(step).toBeVisible();
  await page.getByRole('button', { name: 'Shirt: purple' }).click();
  await page.getByRole('button', { name: 'Hair color: teal' }).click();
  await page.screenshot({ path: 'e2e/.results/avatar-step.png', fullPage: true });
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await expect(page.getByLabel(/^World map with/)).toBeVisible();

  await page.goto('/');
  await playing(page);
  await expect(page.locator('.game-bar .who')).toHaveText(displayNameOf(name));
  const me = (await (await page.request.get('/api/me')).json()) as Me;
  expect(me.user).toMatchObject({
    avatarChosen: true,
    avatar: { shirt: 'purple', hairColor: 'teal' },
  });

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
});

test('server errors appear next to their field, or above the button', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill(unique('short'));
  await page.getByLabel('Display name').fill('Short');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Password again').fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#password-error')).toHaveText(
    'Password must be at least 8 characters',
  );

  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByLabel('Username').fill(unique('nobody'));
  await page.getByLabel('Password').fill('wrong password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('.form-error')).toHaveText('Wrong username or password');
});

test('logging out in another tab sends this one to the login screen', async ({ page }) => {
  await signUp(page, unique('twotabs'));
  await playing(page);

  expect((await page.request.post('/api/logout')).status()).toBe(204);

  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
});
