import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
import { playing, signUp, standingStill, unique } from './helpers.ts';

async function enterGarden(page: Page, tag: string) {
  await signUp(page, unique(tag));
  await playing(page);
  await standingStill(page);
}

const frame = (page: Page) =>
  page
    .getByLabel('Game world')
    .evaluate((c) => (c as unknown as { toDataURL(): string }).toDataURL());

test('the garden moves by itself', async ({ page }) => {
  await enterGarden(page, 'amb');
  const a = await frame(page);
  await expect.poll(() => frame(page)).not.toBe(a);
});

test('reduced motion holds the world still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterGarden(page, 'still');
  let a = '';
  await expect
    .poll(async () => {
      const [was, now] = [a, await frame(page)];
      a = now;
      return now === was;
    })
    .toBe(true);
  await page.waitForTimeout(700);
  expect(await frame(page), 'the world does not change for 700ms').toBe(a);
});
