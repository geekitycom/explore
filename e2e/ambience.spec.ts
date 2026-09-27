import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
import { playing, signUp, unique } from './helpers.ts';

async function enterGarden(page: Page, tag: string) {
  await signUp(page, unique(tag));
  await playing(page);
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
