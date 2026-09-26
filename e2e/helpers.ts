/// <reference lib="dom" />
import type { DatabaseSync } from 'node:sqlite';
import type { Page } from '@playwright/test';
import { TILE, type ScreenCoord, type Tile } from '../packages/core/src/index.ts';

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

/**
 * Moves a signed-out player by rewriting their saved position, then signs them back in there.
 * The server saves a position when the socket closes, so the page leaves first.
 */
export async function teleport(
  page: Page,
  db: DatabaseSync,
  user: string,
  coord: ScreenCoord,
  at: Tile,
) {
  await page.goto('about:blank');
  await page.waitForTimeout(500);
  const { id } = db.prepare('SELECT id FROM users WHERE username = ?').get(user) as { id: number };
  db.prepare(
    `UPDATE player_state SET layer = ?, sx = ?, sy = ?, x = ?, y = ?, dir = 'n' WHERE user_id = ?`,
  ).run(coord.layer, coord.sx, coord.sy, (at.tx + 0.5) * TILE, (at.ty + 1) * TILE - 2, id);
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
