import { expect, test } from '@playwright/test';
import { createAccount, displayNameOf, playing, unique } from './helpers.ts';

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

test('a new player creates an account, chooses an avatar, then enters the game', async ({
  page,
}) => {
  const name = unique('new');
  const bodies: unknown[] = [];
  page.on('request', (req) => {
    if (req.url().endsWith('/api/signup')) bodies.push(req.postDataJSON());
  });
  await createAccount(page, name);
  await expect(page.getByRole('heading', { name: 'Choose your avatar' })).toBeVisible();
  expect(bodies).toEqual([
    { username: name, displayName: displayNameOf(name), password: 'correct horse' },
  ]);
  await expect(page.locator('.tagline')).toContainText(`see you, ${displayNameOf(name)}.`);

  await page.getByRole('button', { name: 'Shirt: purple' }).click();
  await page.getByRole('button', { name: 'Hair color: teal' }).click();
  await page.screenshot({ path: 'e2e/.results/avatar-step.png', fullPage: true });
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await playing(page);
  await expect(page.locator('.game-bar .who')).toHaveText(displayNameOf(name));

  const me = (await (await page.request.get('/api/me')).json()) as Me;
  expect(me.user).toMatchObject({
    avatarChosen: true,
    avatar: { shirt: 'purple', hairColor: 'teal' },
  });

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByLabel('Username').fill(name.toUpperCase());
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
  await page.reload();
  await playing(page);
});

test('a player who leaves during the avatar step gets it again until they save', async ({
  page,
}) => {
  const name = unique('left');
  await createAccount(page, name);
  await expect(page.getByRole('heading', { name: 'Choose your avatar' })).toBeVisible();

  await page.goto('about:blank');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Choose your avatar' })).toBeVisible();

  await page.context().clearCookies();
  await page.goto('/map');
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('heading', { name: 'Choose your avatar' })).toBeVisible();
  await page.getByRole('button', { name: 'Hair: bun' }).click();
  await page.getByRole('button', { name: 'Start exploring' }).click();
  await expect(page.getByLabel(/^World map with/)).toBeVisible();

  await page.goto('/');
  await playing(page);
  const me = (await (await page.request.get('/api/me')).json()) as Me;
  expect(me.user.avatarChosen).toBe(true);
});

test('server validation errors appear next to the field', async ({ page }) => {
  const name = unique('taken');
  await page.request.post('/api/signup', {
    data: { username: name, displayName: 'Taken', password: 'correct horse' },
  });
  await page.context().clearCookies();
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();

  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Display name').fill('   ');
  await page.getByLabel('Password', { exact: true }).fill('long enough pw');
  await page.getByLabel('Password again').fill('long enough pw');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#displayName-error')).toHaveText('Enter a display name');

  await page.getByLabel('Display name').fill('Taken too');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Password again').fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#password-error')).toContainText('at least 8');

  await page.locator('#password').fill('long enough pw');
  await page.getByLabel('Password again').fill('long enough pw');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.locator('#username-error')).toHaveText('That username is taken');

  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('wrong password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('.form-error')).toHaveText('Wrong username or password');
});

test('a throttled login shows the wait inline', async ({ page }) => {
  const name = unique('slow');
  for (let i = 0; i < 10; i++) {
    const res = await page.request.post('/api/login', {
      data: { username: name, password: 'wrong password' },
    });
    expect(res.status()).toBe(401);
  }
  await page.goto('/');
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('wrong password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.locator('.form-error')).toHaveText(
    'Too many attempts. Try again in 15 minutes.',
  );
  await page.screenshot({ path: 'e2e/.results/login-throttled.png', fullPage: true });
});
