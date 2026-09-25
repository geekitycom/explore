import { expect, test, type Page } from '@playwright/test';

async function enterGarden(page: Page, tag: string) {
  await page.goto('/');
  await page.getByLabel('Username').fill(`${tag}${Date.now().toString(36)}`);
  await page.getByLabel('Password').fill('correct horse');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForFunction(
    () =>
      (window as unknown as { exploreState?: () => { phase: string } }).exploreState?.().phase ===
      'playing',
  );
  await page.waitForTimeout(300);
}

const frame = (page: Page) =>
  page
    .getByLabel('Game world')
    .evaluate((c) => (c as unknown as { toDataURL(): string }).toDataURL());

test('the garden moves by itself', async ({ page }) => {
  await enterGarden(page, 'amb');
  const a = await frame(page);
  await page.waitForTimeout(700);
  expect(await frame(page)).not.toBe(a);
});

test('reduced motion holds the world still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterGarden(page, 'still');
  const a = await frame(page);
  await page.waitForTimeout(700);
  expect(await frame(page)).toBe(a);
});
