/// <reference lib="dom" />
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { expect, type Page } from '@playwright/test';
import { TILE, type ScreenCoord, type Tile } from '../packages/core/src/index.ts';

export const unique = (tag: string) =>
  `${tag}${Date.now().toString(36)}${Math.floor(Math.random() * 1e3)}`;

/** The e2e server's accounts database, under the data directory playwright.config.ts picked. */
export const mainDb = () => new DatabaseSync(join(process.env['E2E_DATA_DIR']!, 'main.db'));

/** The world file of world `worldId`. */
export const worldDb = (worldId: number) =>
  new DatabaseSync(join(process.env['E2E_DATA_DIR']!, 'worlds', `${worldId}.db`));

/** The account named `username` and the world it owns. */
export function account(username: string): { id: number; home: number } {
  const main = mainDb();
  const row = main
    .prepare(
      `SELECT users.id AS id, worlds.id AS home FROM users
       JOIN worlds ON worlds.owner_id = users.id WHERE username = ?`,
    )
    .get(username) as { id: number; home: number };
  main.close();
  return row;
}

/**
 * The display name the helpers sign `username` up with. It is the username reversed, so any spec
 * that finds the username where players see names fails.
 */
export const displayNameOf = (username: string) => [...username].reverse().join('');

let signupAddress = 0;

/**
 * Fills and submits the create-account form, leaving the new player on the avatar step. Each
 * account comes from its own address, so the suite never trips the per-address signup limit.
 */
export async function createAccount(
  page: Page,
  name: string,
  { retyped = 'correct horse', displayName = displayNameOf(name) } = {},
) {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${++signupAddress % 256}` });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Username').fill(name);
  await page.getByLabel('Display name').fill(displayName);
  await page.getByLabel('Password', { exact: true }).fill('correct horse');
  await page.getByLabel('Password again').fill(retyped);
  await page.getByRole('button', { name: 'Create account' }).click();
}

export async function signUp(page: Page, name: string) {
  await createAccount(page, name);
  await page.getByRole('button', { name: 'Start exploring' }).click();
}

const phase = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { exploreState?: () => { phase: string } }).exploreState?.().phase,
  );

/** Waits until the player can move, first waking them up when the session is a new one. */
export async function playing(page: Page) {
  await expect.poll(() => phase(page), { intervals: [50] }).toMatch(/^(waking|playing)$/);
  if ((await phase(page)) === 'waking') await wakeUp(page);
}

/** Waits for the wake-up message to show in full, then presses Space to start. */
export async function wakeUp(page: Page) {
  await expect(page.locator('.wake-text')).toHaveCSS('opacity', '1');
  await page.keyboard.press('Space');
  await expect.poll(() => phase(page), { intervals: [50] }).toBe('playing');
}

/**
 * Moves a signed-out player by rewriting their saved position, then signs them back in there.
 * The server saves a position when the socket closes, so the page leaves first.
 */
export async function teleport(page: Page, user: string, coord: ScreenCoord, at: Tile) {
  await page.goto('about:blank');
  await page.waitForTimeout(500);
  const { id, home } = account(user);
  const world = worldDb(home);
  world
    .prepare(
      `UPDATE player_state SET layer = ?, sx = ?, sy = ?, x = ?, y = ?, dir = 'n' WHERE user_id = ?`,
    )
    .run(coord.layer, coord.sx, coord.sy, (at.tx + 0.5) * TILE, (at.ty + 1) * TILE - 2, id);
  world.close();
  await page.goto('/');
  await playing(page);
}

/** Taps everything reaching the speakers; call before the page loads, then poll the RMS level. */
export async function probeOutput(page: Page) {
  await page.addInitScript(() => {
    const node = AudioNode.prototype as unknown as {
      connect: (this: AudioNode, ...args: unknown[]) => unknown;
    };
    const connect = node.connect;
    let analyser: AnalyserNode | undefined;
    node.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode) {
        analyser ??= this.context.createAnalyser();
        connect.call(this, analyser);
      }
      return connect.call(this, dest, ...rest);
    };
    Object.assign(window, {
      outputLevel: () => {
        if (!analyser) return 0;
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
      },
    });
  });
  return () =>
    page.evaluate(() => (window as unknown as { outputLevel: () => number }).outputLevel());
}

const friendsDialog = (page: Page) => page.getByRole('dialog', { name: 'Play with friends' });

/** Opens the player's world from the Friends dialog and returns the code it shows. */
export async function openForVisitors(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Friends' }).click();
  const dialog = friendsDialog(page);
  await dialog.getByRole('button', { name: 'Open for visitors' }).click();
  const code = (await dialog.getByLabel('Visit code').textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-Z]{5}$/);
  await dialog.getByRole('button', { name: 'Done' }).click();
  return code;
}

/** Closes the player's world to visitors from the Friends dialog. */
export async function closeToVisitors(page: Page) {
  await page.getByRole('button', { name: 'Friends' }).click();
  const dialog = friendsDialog(page);
  await dialog.getByRole('button', { name: 'Close to visitors' }).click();
  await expect(dialog.getByRole('button', { name: 'Open for visitors' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Done' }).click();
}

/** Types a friend's code into the Friends dialog; resolves once the player can move in their world. */
export async function visit(page: Page, code: string) {
  await page.getByRole('button', { name: 'Friends' }).click();
  const dialog = friendsDialog(page);
  await dialog.getByLabel('Their code').fill(code);
  await dialog.getByRole('button', { name: 'Go' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/worlds\/\d+$/);
  await playing(page);
}
