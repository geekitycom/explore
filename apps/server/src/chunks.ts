import type { DatabaseSync } from 'node:sqlite';
import {
  chunkKey,
  chunkOf,
  chunkScreens,
  generateScreen,
  type ChunkCoord,
  type Older,
  type Screen,
  type ScreenCoord,
  type World,
} from '@explore/core';
import { getScreen, isChunkStored, loadWorld, olderScreen, storeChunk } from './world.ts';

/** Builds one screen, stitched to the stored screens `older` finds around it. */
type Generate = (world: World, coord: ScreenCoord, older: Older) => Screen;

/** A chunk being built: its screens so far, in `coords` order. */
type Job = {
  readonly chunk: ChunkCoord;
  readonly world: World;
  readonly coords: readonly ScreenCoord[];
  readonly screens: Screen[];
  readonly userId: number;
};

const NEARBY = [-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => ({ dx, dy })));

/**
 * Generates and stores the world a chunk at a time. `screenAt` builds the chunk of an unstored
 * screen before returning, all in one transaction. `prefetchAround` builds the chunks next to a
 * player one screen per turn of the event loop, so a move is never held up for more than one
 * screen. Each chunk has at most one job, and a synchronous build finishes that job rather than
 * generating the chunk again, so a chunk is generated once however players arrive at it.
 */
export class Chunks {
  readonly #db: DatabaseSync;
  readonly #generate: Generate;
  readonly #older: Older;
  readonly #jobs = new Map<string, Job>();
  #turn: NodeJS.Immediate | undefined;

  constructor(db: DatabaseSync, generate: Generate = generateScreen) {
    this.#db = db;
    this.#generate = generate;
    this.#older = (coord) => olderScreen(db, coord);
  }

  screenAt(coord: ScreenCoord, userId: number): Screen {
    const stored = getScreen(this.#db, coord);
    if (stored) return stored;
    const job = this.#jobFor(chunkOf(coord), userId);
    while (!this.#step(job));
    return getScreen(this.#db, coord)!;
  }

  prefetchAround({ layer, sx, sy }: ScreenCoord, userId: number): void {
    const nearby = new Map<string, ChunkCoord>();
    for (const { dx, dy } of NEARBY) {
      const chunk = chunkOf({ layer, sx: sx + dx, sy: sy + dy });
      nearby.set(chunkKey(chunk), chunk);
    }
    for (const [key, chunk] of nearby) {
      if (!this.#jobs.has(key) && !isChunkStored(this.#db, chunk)) this.#jobFor(chunk, userId);
    }
    this.#schedule();
  }

  stop(): void {
    clearImmediate(this.#turn);
    this.#turn = undefined;
    this.#jobs.clear();
  }

  #jobFor(chunk: ChunkCoord, userId: number): Job {
    const key = chunkKey(chunk);
    let job = this.#jobs.get(key);
    if (!job) {
      job = { chunk, world: loadWorld(this.#db), coords: chunkScreens(chunk), screens: [], userId };
      this.#jobs.set(key, job);
    }
    return job;
  }

  /**
   * Generates the job's next screen; stores the chunk and returns true once it has them all.
   * A job that fails is forgotten, so the next approach to its chunk starts afresh.
   */
  #step(job: Job): boolean {
    const key = chunkKey(job.chunk);
    try {
      job.screens.push(this.#generate(job.world, job.coords[job.screens.length]!, this.#older));
    } catch (error) {
      this.#jobs.delete(key);
      throw error;
    }
    if (job.screens.length < job.coords.length) return false;
    this.#jobs.delete(key);
    storeChunk(this.#db, job.screens, job.userId);
    return true;
  }

  #schedule(): void {
    if (this.#turn || this.#jobs.size === 0) return;
    this.#turn = setImmediate(() => {
      this.#turn = undefined;
      const job = this.#jobs.values().next().value;
      try {
        if (job) this.#step(job);
      } catch (error) {
        console.error(`prefetch of chunk ${chunkKey(job!.chunk)} failed`, error);
      }
      this.#schedule();
    });
  }
}
