import {
  screenKey,
  type Place,
  type Screen,
  type Trace,
  type TraceKindName,
  type World,
} from '@explore/core';
import type { TextRequest, TextResult } from './text-gen.ts';
import type { TraceStore } from './traces.ts';

export type WriteText = (request: TextRequest) => Promise<TextResult>;

/** How the language model rewrites one kind's seed text. The writer decides when, and once. */
export type Scribe<T extends Trace> = {
  readonly kind: T['kind'];
  /** Still carrying seed text the model should replace. */
  waiting(trace: T): boolean;
  request(trace: T, world: World, screen: Screen): TextRequest;
  /** The trace with the model's words, or undefined when the reply is not fit to show. */
  written(trace: T, reply: string): T | undefined;
};

const isOf = <T extends Trace>(scribe: Scribe<T>, trace: Trace): trace is T =>
  trace.kind === scribe.kind;

/**
 * Has the language model rewrite seed text off the screen-generation path, one trace at a time
 * per kind. Each trace is tried once per world open; a failed try keeps the seed text. Words
 * that changed during the wait are never overwritten.
 */
export function textWriter(
  store: TraceStore,
  writeText: WriteText,
  scribes: readonly Scribe<Trace>[],
) {
  const tried = new Set<string>();
  const queues = new Map<TraceKindName, Promise<void>>();
  let stopped = false;

  async function write<T extends Trace>(scribe: Scribe<T>, trace: T, world: World, screen: Screen) {
    if (stopped) return;
    const result = await writeText(scribe.request(trace, world, screen));
    const { coord } = screen;
    const stored = stopped ? undefined : store.get(coord, trace, scribe.kind);
    if (!stored || !isOf(scribe, stored) || !scribe.waiting(stored)) return;
    const next = result.kind === 'ok' ? scribe.written(stored, result.text) : undefined;
    if (next) return store.commit(coord, [{ put: next }], null);
    const why = result.kind === 'ok' ? `filtered "${result.text}"` : result.kind;
    console.warn(`${scribe.kind} at ${trace.tx},${trace.ty} on ${screenKey(coord)}: ${why}`);
  }

  function ask<T extends Trace>(scribe: Scribe<T>, place: Place, world: World) {
    const { screen } = place;
    for (const trace of place.traces.values()) {
      if (!isOf(scribe, trace) || !scribe.waiting(trace)) continue;
      const key = `${screenKey(screen.coord)}:${trace.tx},${trace.ty},${trace.kind}`;
      if (tried.has(key)) continue;
      tried.add(key);
      const queue = (queues.get(scribe.kind) ?? Promise.resolve())
        .then(() => write(scribe, trace, world, screen))
        .catch((error: unknown) => console.error(`${scribe.kind} write failed`, error));
      queues.set(scribe.kind, queue);
    }
  }

  return {
    request(place: Place, world: World): void {
      for (const scribe of scribes) ask(scribe, place, world);
    },
    /** Resolves once every trace asked for so far is written or given up. */
    idle: async (): Promise<void> => {
      await Promise.all(queues.values());
    },
    stop(): void {
      stopped = true;
    },
  };
}

export type TextWriter = ReturnType<typeof textWriter>;
