import { z } from 'zod';
import {
  LANDMARK_NOUNS,
  inArea,
  landmarkOn,
  signpostSpot,
  type Landmark,
} from '../../landmarks.ts';
import { POI_KINDS, type PoiKind } from '../../poi.ts';
import { centreTile, isWalkable } from '../../walk.ts';
import { epochMs, userRef } from '../fields.ts';
import { refuse, traceKind, type Here, type TraceKind } from '../kind.ts';

export const NAME_MAX = 30;
export const LINE_MAX = 80;

/** Runs of whitespace fold to one space and the ends are trimmed; control characters never pass. */
const text = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.replace(/\s+/g, ' ').trim())
    .pipe(
      z
        .string()
        .min(min)
        .max(max)
        .regex(/^[^\p{C}]*$/u),
    );

/** From poi.ts rather than landmarks.ts, which reaches the registry through the generator. */
const landmarkKinds = (Object.keys(POI_KINDS) as PoiKind[]).filter(
  (k): k is Landmark['poi'] => k !== 'hub',
) as [Landmark['poi'], ...Landmark['poi'][]];

const fields = {
  poi: z.enum(landmarkKinds),
  area: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    rx: z.number().positive(),
    ry: z.number().positive(),
  }),
  named: z
    .object({
      name: z.string().min(1).max(NAME_MAX),
      line: z.string().min(1).max(LINE_MAX).optional(),
      by: userRef,
      at: epochMs,
    })
    .optional(),
};

const naming = z.discriminatedUnion('op', [
  z.object({ op: z.literal('name'), name: text(1, NAME_MAX), line: text(0, LINE_MAX) }),
  z.object({ op: z.literal('clear') }),
]);

type Site = z.output<z.ZodObject<typeof fields>> & { readonly tx: number; readonly ty: number };

/** The screen's landmark trace, which `settle` put at its signpost spot. */
export function siteOf(here: Pick<Here, 'place'>): Site | undefined {
  for (const trace of here.place.traces.values()) if (trace.kind === 'landmark') return trace;
  return undefined;
}

/**
 * A landmark players can name. The generator fixes where its signpost will stand; until someone
 * names it the trace there is invisible and walkable, and only carries the landmark's area.
 */
export const landmark: TraceKind<
  'landmark',
  typeof fields,
  never,
  z.output<typeof naming>
> = traceKind({
  kind: 'landmark',
  fields,
  solid: (trace) => trace.named !== undefined,
  look: (trace) => ({
    hidesFeature: false,
    recipe: trace.named && { family: 'signpost', params: { wood: 'bark' } },
  }),
  bubble: ({ named }) =>
    named && {
      text: named.name,
      ...(named.line ? { line: named.line } : {}),
      by: named.by,
      credit: 'named by',
    },
  offer: (here) => {
    const site = siteOf(here);
    return site && !site.named && inArea(site.area, centreTile(here.me.pose))
      ? 'Name this place'
      : undefined;
  },
  settle: (place, world) => {
    if (siteOf({ place })) return [];
    const found = landmarkOn(world, place.screen.coord);
    const spot = found && signpostSpot(place.screen, found.area);
    return found && spot ? [{ put: { kind: 'landmark', ...spot, ...found } }] : [];
  },
  action: {
    input: naming,
    apply: (here, input) => {
      const site = siteOf(here);
      if (!site) return refuse('There is no landmark here to name.');
      const at = { tx: site.tx, ty: site.ty };
      const { named, ...unnamed } = site;
      const mine = named?.by.id === here.me.id;
      if (named && !mine) return refuse(`${named.by.name} named this place first.`);
      if (input.op === 'clear') {
        return mine
          ? { ok: true, label: 'Clear the name', next: unnamed, at }
          : refuse('This place has no name to clear.');
      }
      if (!named && !inArea(site.area, centreTile(here.me.pose)))
        return refuse(`Stand in the ${LANDMARK_NOUNS[site.poi]} to name it.`);
      if (!named && !isWalkable(here.place, at.tx, at.ty))
        return refuse('Something stands where the signpost goes.');
      return {
        ok: true,
        label: named ? 'Rename this place' : 'Name this place',
        next: {
          ...unnamed,
          named: {
            name: input.name,
            ...(input.line ? { line: input.line } : {}),
            by: { id: here.me.id, name: here.me.name },
            at: here.now,
          },
        },
        at,
      };
    },
  },
});
