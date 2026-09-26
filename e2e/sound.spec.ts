/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { probeOutput, signUp } from './helpers.ts';

type AudioSnapshot = {
  state: string;
  tune: string | undefined;
  ambience: { wind: number; river: number; waves: number };
  ambienceLoaded: string[];
  settings: { muted: boolean; music: number; effects: number };
};

const audio = (page: Page) =>
  page.evaluate(() => (window as unknown as { exploreAudio: () => AudioSnapshot }).exploreAudio());

const coord = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          exploreState: () => {
            place?: { screen: { coord: { layer: string; sx: number; sy: number } } };
          };
        }
      ).exploreState().place?.screen.coord,
  );

test('music and ambience wait for input, follow the world, and settings persist', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text());
  });

  await signUp(page, `snd${Date.now().toString(36)}`);
  await expect(page.getByLabel('Game world')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Game world')).toBeVisible();
  await page.waitForTimeout(300);
  expect((await audio(page)).state).toBe('locked');

  await page.keyboard.press('Shift');
  await expect.poll(async () => (await audio(page)).state).toBe('running');
  await expect.poll(async () => (await audio(page)).tune).toBe('garden:1');
  expect((await audio(page)).ambience.wind).toBeGreaterThan(0);
  await expect.poll(async () => (await audio(page)).ambienceLoaded).toContain('wind');

  await page.keyboard.down('ArrowDown');
  await expect
    .poll(async () => coord(page), { intervals: [20] })
    .toEqual({ layer: 'overworld', sx: 0, sy: 1 });
  await page.keyboard.up('ArrowDown');
  await expect.poll(async () => (await audio(page)).tune).not.toBe('garden:1');
  await page.keyboard.down('ArrowUp');
  await expect
    .poll(async () => coord(page), { intervals: [20] })
    .toEqual({ layer: 'overworld', sx: 0, sy: 0 });
  await page.keyboard.up('ArrowUp');
  await expect.poll(async () => (await audio(page)).tune).toBe('garden:1');

  await page.getByRole('button', { name: 'Sound' }).click();
  await page.getByLabel('Mute').check();
  await page.getByLabel('Music').fill('20');
  await page.screenshot({ path: 'e2e/.results/sound-panel.png' });
  await page.reload();
  await expect(page.getByLabel('Game world')).toBeVisible();
  expect((await audio(page)).settings).toEqual({ muted: true, music: 0.2, effects: 0.7 });
  await page.getByRole('button', { name: 'Sound' }).click();
  await expect(page.getByLabel('Mute')).toBeChecked();

  expect(errors.filter((e) => /AudioContext/i.test(e))).toEqual([]);
});

test('ambience plays on the effects bus and obeys mute and the effects volume', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('explore.sound', JSON.stringify({ muted: false, music: 0, effects: 0.7 }));
  });
  const level = await probeOutput(page);

  await signUp(page, `amb${Date.now().toString(36)}`);
  await expect(page.getByLabel('Game world')).toBeVisible();
  await page.keyboard.press('Shift');
  await expect.poll(level, { timeout: 10_000 }).toBeGreaterThan(0.002);

  await page.getByRole('button', { name: 'Sound' }).click();
  await page.getByLabel('Mute').check();
  await expect.poll(level).toBe(0);
  await page.getByLabel('Mute').uncheck();
  await expect.poll(level).toBeGreaterThan(0.002);
  await page.getByLabel('Effects').fill('0');
  await expect.poll(level).toBe(0);
});
