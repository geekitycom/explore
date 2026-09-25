import type { Page } from '@playwright/test';

export const unique = (tag: string) =>
  `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

export async function signUp(page: Page, name: string) {
  await page.goto('/');
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Create account' }).click();
}

export const playing = (page: Page) =>
  page.waitForFunction(
    () =>
      (window as unknown as { exploreState?: () => { phase: string } }).exploreState?.().phase ===
      'playing',
  );
