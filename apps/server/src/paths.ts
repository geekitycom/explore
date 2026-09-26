import { join, resolve } from 'node:path';
import type { WorldId } from './worlds.ts';

/** The data directory: `DATA_DIR`, else `./data` relative to where the server was started. */
export const dataDir = (): string => resolve(process.env.DATA_DIR ?? './data');

export const mainDbPath = (dir: string): string => join(dir, 'main.db');

export const worldsDir = (dir: string): string => join(dir, 'worlds');

export const worldDbPath = (dir: string, worldId: WorldId): string =>
  join(worldsDir(dir), `${worldId}.db`);
