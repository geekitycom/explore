/// <reference lib="dom" />
import type { Page } from '@playwright/test';
import { expect, test } from './test.ts';
import { GARDEN_SPAWN } from '../packages/core/src/index.ts';
import { signUp, unique, wakeUp } from './helpers.ts';

const MESSAGE =
  'You wake up in a secret garden. You feel the grass between your toes. Click to start.';

type Snapshot = {
  phase: string;
  place?: { screen: { coord: { layer: string; sx: number; sy: number } } };
  you?: { x: number; y: number };
};

const snapshot = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { exploreState: () => Snapshot }).exploreState();
    return {
      phase: s.phase,
      coord: s.place?.screen.coord,
      you: s.you && { x: s.you.x, y: s.you.y },
    };
  });

const tune = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { exploreAudio: () => { tune?: string } }).exploreAudio().tune,
  );

const GARDEN = { layer: 'overworld', sx: 0, sy: 0 };
const SPAWN = { x: GARDEN_SPAWN.x, y: GARDEN_SPAWN.y };

/** Freezes every running animation at `ms` from its start, for a screenshot. */
const seek = (page: Page, ms: number) =>
  page.evaluate((at) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = at;
    }
  }, ms);

const resume = (page: Page) =>
  page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.play();
  });

test('a new session opens its eyes on the garden and holds still until Space', async ({ page }) => {
  await signUp(page, unique('wake'));
  await expect(page.locator('.wake')).toBeVisible();
  expect(await snapshot(page)).toEqual({ phase: 'waking', coord: GARDEN, you: SPAWN });

  await seek(page, 0);
  await page.screenshot({ path: 'e2e/.results/wake-black.png' });
  await seek(page, 900);
  await page.screenshot({ path: 'e2e/.results/wake-reveal.png' });
  await resume(page);

  const message = page.locator('.wake-text');
  await expect(message).toHaveText(MESSAGE, { useInnerText: true });
  await expect(message).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'e2e/.results/wake-message.png' });

  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(500);
  await page.keyboard.up('ArrowUp');
  expect(await snapshot(page), 'the player holds still until Space').toEqual({
    phase: 'waking',
    coord: GARDEN,
    you: SPAWN,
  });
  expect(await tune(page), 'no music plays until Space').toBeUndefined();

  await wakeUp(page);
  await expect(page.locator('.wake')).toHaveCount(0);
  await expect.poll(() => tune(page)).toBe('garden:1');
  await page.keyboard.down('ArrowUp');
  await expect.poll(async () => (await snapshot(page)).you!.y).toBeLessThan(SPAWN.y - 10);
  await page.keyboard.up('ArrowUp');
  await page.screenshot({ path: 'e2e/.results/garden-layout.png' });
});

test('with reduced motion the dark fades instead of opening like eyes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signUp(page, unique('calm'));
  await expect(page.locator('.wake')).toBeVisible();
  await seek(page, 200);
  const lid = page.locator('.lid-top');
  await expect(lid).toHaveCSS('transform', 'none');
  expect(Number(await lid.evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(1);
  await resume(page);
  await wakeUp(page);
});
