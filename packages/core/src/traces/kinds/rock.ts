import { z } from 'zod';
import type { Species } from '../../flora.ts';
import type { RampName } from '../../palette.ts';
import { CAIRN_MAX } from '../../recipes/index.ts';
import { rampName } from '../fields.ts';
import { refuse, traceKind, type Spot, type TraceKind } from '../kind.ts';

const stone = z.object({
  stone: rampName,
  /** Who put it here; a generated rock that a cairn was started on has no builder. */
  by: z.number().int().optional(),
});
const fields = {
  /**
   * Bottom stone first. Empty where a generated rock was taken, one stone for a loose rock, and
   * two or more for a cairn.
   */
  stack: z.array(stone).max(CAIRN_MAX),
};

type Stone = z.output<typeof stone>;

const NAMES: Partial<Record<RampName, string>> = {
  granite: 'Granite',
  sand: 'Sandstone',
  stone: 'Fieldstone',
};

/** The generated rock's material: rocks are conserved, so a taken one keeps what it was made of. */
const materialOf = (plant: Species | undefined): RampName =>
  plant?.recipe.family === 'rock' ? plant.recipe.params.stone : 'stone';

/** The stones on the tile now, counting a generated rock nobody has taken. */
function stackOn(spot: Spot<{ readonly stack: readonly Stone[] }>): readonly Stone[] {
  if (spot.mine) return spot.mine.stack;
  return spot.feature === 'rock' ? [{ stone: materialOf(spot.plant) }] : [];
}

const builders = (stack: readonly Stone[]) =>
  new Set(stack.flatMap((s) => (s.by === undefined ? [] : [s.by]))).size;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Rocks are only ever moved: a stone picked up leaves the world, and one put down is a loose
 * rock or the next stone of a cairn.
 */
export const rock: TraceKind<'rock', typeof fields, RampName, never> = traceKind({
  kind: 'rock',
  fields,
  limits: { carry: 3, cairn: CAIRN_MAX },
  solid: (trace) => trace.stack.length > 0,
  look: (trace) => ({
    hidesFeature: true,
    recipe:
      trace.stack.length > 0
        ? { family: 'cairn', params: { stones: trace.stack.map((s) => s.stone) } }
        : undefined,
  }),
  bubble: (trace) => {
    const n = trace.stack.length;
    if (n < 2) return undefined;
    const counts = `${plural(n, 'stone', 'stones')}, ${plural(builders(trace.stack), 'builder', 'builders')}`;
    return { text: n === CAIRN_MAX ? `Complete cairn: ${counts}` : `Cairn: ${counts}` };
  },
  interact: (_here, spot) => {
    const stack = stackOn(spot);
    if (stack.length === 0) return undefined;
    if (stack.length > 1) return refuse('Stones in a cairn stay put.');
    return {
      ok: true,
      label: 'Pick up the stone',
      next: spot.feature === 'rock' ? { stack: [] } : null,
      gain: { kind: 'rock', variant: stack[0]!.stone },
    };
  },
  carry: {
    variant: rampName,
    full: 'You can only carry 3 stones.',
    name: (variant) => NAMES[variant] ?? 'Stone',
    icon: (variant) => ({ family: 'rock', params: { stone: variant, size: 0.4 } }),
    use: (here, spot, variant) => {
      const stack = stackOn(spot);
      const added = { stack: [...stack, { stone: variant, by: here.me.id }] };
      if (stack.length >= CAIRN_MAX) return refuse('This cairn is complete.');
      if (stack.length === 1) return { ok: true, label: 'Start a cairn', next: added };
      if (stack.length > 1) return { ok: true, label: 'Add a stone to the cairn', next: added };
      if (spot.corners.includes('water')) return refuse('It would sink.');
      if (spot.corners.includes('path')) return refuse('Keep the road clear.');
      const bare = spot.feature === 'none' || spot.feature === 'rock';
      if (!bare || !spot.walkable || spot.traces.some((t) => t.kind !== 'rock'))
        return refuse('Something is in the way.');
      return { ok: true, label: 'Put the stone down', next: added };
    },
  },
});
