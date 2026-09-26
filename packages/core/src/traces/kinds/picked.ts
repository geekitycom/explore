import { flowerRecipe, pickable } from '../../flora.ts';
import { DAY_MS, epochMs } from '../fields.ts';
import { refuse, traceKind, type TraceKind } from '../kind.ts';

/** A picked plant is a sprout for the first half of regrowDays, then a bud. */
const limits = { regrowDays: 2 };

export const REGROWING = 'It has not grown back yet.';

const fields = { at: epochMs };

/** Undefined once in full flower again. */
export function regrowth(at: number, now: number): 'sprout' | 'bud' | undefined {
  const days = (now - at) / DAY_MS;
  return days < limits.regrowDays / 2 ? 'sprout' : days < limits.regrowDays ? 'bud' : undefined;
}

/** When a flower patch was last picked. It regrows for everyone; picking only costs time. */
export const picked: TraceKind<'picked', typeof fields, never, never> = traceKind({
  kind: 'picked',
  fields,
  limits,
  solid: () => false,
  look: (trace, ground, now) => {
    const flower = pickable(ground.plant);
    return {
      hidesFeature: flower !== undefined,
      recipe: flower && flowerRecipe(flower, regrowth(trace.at, now)),
    };
  },
  interact: (here, spot) => {
    const flower = pickable(spot.plant);
    if (!flower) return undefined;
    if (spot.mine && regrowth(spot.mine.at, here.now)) return refuse(REGROWING);
    return {
      ok: true,
      label: `Pick the ${flower.name.toLowerCase()}`,
      next: { at: here.now },
      gain: { kind: 'flowers', variant: flower.name },
    };
  },
});
