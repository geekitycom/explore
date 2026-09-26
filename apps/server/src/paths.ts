import { join, resolve } from 'node:path';

/** Until TASK-64.2 registers worlds, every player shares this one. */
export const SHARED_WORLD_ID = 1;

/** The data directory: `DATA_DIR`, else `./data` relative to where the server was started. */
export const dataDir = (): string => resolve(process.env.DATA_DIR ?? './data');

export const mainDbPath = (dir: string): string => join(dir, 'main.db');

export const worldDbPath = (dir: string, worldId: number): string =>
  join(dir, 'worlds', `${worldId}.db`);
