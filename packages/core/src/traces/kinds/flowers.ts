import { z } from 'zod';
import { FLOWERS, flowerRecipe } from '../../flora.ts';
import { DAY_MS, epochMs, userRef } from '../fields.ts';
import { refuse, traceKind, type TraceKind } from '../kind.ts';

/** Flowers on a grave stay fresh for freshDays, then wilt until goneDays. */
const limits = { freshDays: 3, goneDays: 5 };

export const NOT_A_GRAVE = 'Flowers can only be placed on graves.';
export const GRAVE_HAS_FLOWERS = 'This grave already has flowers.';

const species = z.enum([...FLOWERS.keys()] as [string, ...string[]]);
const fields = { species, by: userRef, at: epochMs };

/** Undefined once they are gone. */
export function graveBunch(at: number, now: number): 'bunch' | 'wilted' | undefined {
  const days = (now - at) / DAY_MS;
  return days < limits.freshDays ? 'bunch' : days < limits.goneDays ? 'wilted' : undefined;
}

const recipeOf = (name: string, form: 'bunch' | 'wilted') => flowerRecipe(FLOWERS.get(name)!, form);

/** Picked flowers: carried as a stack per species, then left on a grave. */
export const flowers: TraceKind<'flowers', typeof fields, string, never> = traceKind({
  kind: 'flowers',
  fields,
  limits,
  solid: () => false,
  look: (trace, _ground, now) => {
    const form = graveBunch(trace.at, now);
    return { hidesFeature: false, recipe: form && recipeOf(trace.species, form) };
  },
  bubble: (trace, now) => graveBunch(trace.at, now) && `${trace.species}, left by ${trace.by.name}`,
  carry: {
    variant: species,
    full: 'You cannot carry any more flowers.',
    name: (variant) => variant,
    icon: (variant) => recipeOf(variant, 'bunch'),
    use: (here, spot, variant) =>
      spot.feature !== 'grave'
        ? refuse(NOT_A_GRAVE)
        : spot.mine && graveBunch(spot.mine.at, here.now)
          ? refuse(GRAVE_HAS_FLOWERS)
          : {
              ok: true,
              label: `Leave the ${variant.toLowerCase()}`,
              next: { species: variant, by: { id: here.me.id, name: here.me.name }, at: here.now },
            },
  },
});
