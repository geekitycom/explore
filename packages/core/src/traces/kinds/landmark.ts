import { z } from 'zod';
import {
  LANDMARK_NOUNS,
  inArea,
  landmarkOn,
  signpostSpot,
  type Landmark,
} from '../../landmarks.ts';
import type { Tile } from '../../place.ts';
import { POI_KINDS, type PoiKind } from '../../poi.ts';
import { centreTile, inReach, isWalkable } from '../../walk.ts';
import type { Pose, ScreenCoord, World } from '../../world.ts';
import { epochMs, userRef } from '../fields.ts';
import { tileHash } from '../hash.ts';
import { refuse, traceKind, type Here, type TraceKind } from '../kind.ts';
import { NAMES } from './epitaph.ts';

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

/**
 * Where the land's words came from: `pending` is the seed text waiting for the language model,
 * `seed` is the seed text for good, after an admin put it back, and `model` is the model's.
 */
export const SIGN_SOURCES = ['pending', 'seed', 'model'] as const;

const words = { name: z.string().min(1).max(NAME_MAX), line: z.string().min(1).max(LINE_MAX) };

const fields = {
  poi: z.enum(landmarkKinds),
  area: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    rx: z.number().positive(),
    ry: z.number().positive(),
  }),
  /** What the land calls the place. Optional because stored traces have no version, and rows from before it must still parse. */
  sign: z.object({ ...words, source: z.enum(SIGN_SOURCES) }).optional(),
  /** A player's name for the place, shown over the sign. */
  named: z.object({ ...words, line: words.line.optional(), by: userRef, at: epochMs }).optional(),
};

const naming = z.discriminatedUnion('op', [
  z.object({ op: z.literal('name'), name: text(1, NAME_MAX), line: text(0, LINE_MAX) }),
  z.object({ op: z.literal('clear') }),
]);

export type Site = z.output<z.ZodObject<typeof fields>> & {
  readonly tx: number;
  readonly ty: number;
};
export type Sign = NonNullable<Site['sign']>;

/** What the signpost reads. Only a player's name has a `by`. */
export type Words = {
  readonly name: string;
  readonly line?: string | undefined;
  readonly by?: { readonly id: number; readonly name: string };
};

/** The screen's landmark trace, which `settle` put at its signpost spot. */
export function siteOf(here: Pick<Here, 'place'>): Site | undefined {
  for (const trace of here.place.traces.values()) if (trace.kind === 'landmark') return trace;
  return undefined;
}

/** A player's name over the land's; undefined for an old site no post could stand on yet. */
export function wordsOf({ named, sign }: Site): Words | undefined {
  if (named) return named;
  return sign && { name: sign.name, line: sign.line };
}

const WORDS: Readonly<Record<Landmark['poi'], readonly string[]>> = {
  clearing: ['Clearing', 'Glade', 'Lea', 'Meadow'],
  grove: ['Grove', 'Copse', 'Holt', 'Wood'],
  ruin: ['Ruin', 'Walls', 'Keep', 'Hall'],
  graveyard: ['Graveyard', 'Churchyard', 'Rest', 'Acre'],
  burialground: ['Barrows', 'Mounds', 'Howe', 'Barrow'],
  lakeside: ['Shore', 'Mere', 'Water', 'Strand'],
  stones: ['Stones', 'Ring', 'Circle', 'Standing Stones'],
  town: ['Green', 'Common', 'Cross', 'Market'],
  cave: ['Cave', 'Grotto', 'Deep', 'Mouth'],
};

const LOOKS = [
  'Hollow',
  'Whispering',
  'Quiet',
  'Old',
  'Mossy',
  'Lantern',
  'Crooked',
  'Sleepy',
  'Windy',
  'Bramble',
  'Hare',
  'Owl',
  'Heron',
  'Thistle',
  'Foxglove',
  'Amber',
  'Silver',
  'Wandering',
  'Drowsy',
  'Lost',
  'Honey',
  'Rook',
  'Nettle',
  'Misty',
];

const LINES = [
  'The wind keeps count here.',
  'Rest your feet a while.',
  'Mind the hares at dusk.',
  'Someone left the kettle on, long ago.',
  'Quiet now. Listen.',
  'Nobody remembers who named it first.',
  'Travellers welcome, mud and all.',
  'The crows know the way home.',
  'Stay for the sunset if you can.',
  'Every path here leads somewhere.',
  'Leave it as you found it.',
  'Once there was a song about this place.',
  'The ground hums on still nights.',
  'Walk softly; things are sleeping.',
  'Good for picnics, better for naps.',
  'Take the long way. It is worth it.',
];

const pick = <T>(list: readonly T[], h: number): T => list[h % list.length]!;

/**
 * The name and line a landmark carries until the language model writes them, or for good
 * without one. The same for every player of a world.
 */
export function seedSign(
  world: World,
  coord: ScreenCoord,
  { tx, ty }: Tile,
  poi: Landmark['poi'],
): Sign {
  const h = tileHash(coord, tx, ty, world.seed);
  const word = pick(WORDS[poi], h >>> 4);
  const look = pick(LOOKS, h >>> 8);
  const forms = [`${look} ${word}`, `The ${look} ${word}`, `${pick(NAMES, h >>> 14)}'s ${word}`];
  return { name: pick(forms, h), line: pick(LINES, h >>> 20), source: 'pending' };
}

const nearSite = (site: Site, pose: Pose) =>
  inArea(site.area, centreTile(pose)) || inReach(pose, site);

/**
 * A named place. The generator fixes where its signpost stands, and it carries the land's words
 * from the first visit. Anyone may lay their own name over them or take a player's name off
 * again. An old site no post could stand on stays invisible and is named as it always was.
 */
export const landmark: TraceKind<
  'landmark',
  typeof fields,
  never,
  z.output<typeof naming>
> = traceKind({
  kind: 'landmark',
  fields,
  solid: (trace) => wordsOf(trace) !== undefined,
  look: (trace) => ({
    hidesFeature: false,
    recipe: wordsOf(trace) && { family: 'signpost', params: { wood: 'bark' } },
  }),
  bubble: (trace) => {
    const shown = wordsOf(trace);
    return (
      shown && {
        text: shown.name,
        ...(shown.line ? { line: shown.line } : {}),
        ...(shown.by ? { by: shown.by, credit: 'named by' } : {}),
      }
    );
  },
  offer: (here) => {
    const site = siteOf(here);
    if (!site) return undefined;
    if (wordsOf(site)) return nearSite(site, here.me.pose) ? 'Rename this place' : undefined;
    return inArea(site.area, centreTile(here.me.pose)) ? 'Name this place' : undefined;
  },
  settle: (place, world) => {
    const site = siteOf({ place });
    if (site?.sign) return [];
    const { coord } = place.screen;
    if (site?.named)
      return [{ put: { ...site, kind: 'landmark', sign: seedSign(world, coord, site, site.poi) } }];
    const found = site ?? landmarkOn(world, coord);
    const spot = found && signpostSpot(place, found.area);
    if (!found || !spot) return [];
    const { poi, area } = found;
    const put = {
      put: { kind: 'landmark', ...spot, poi, area, sign: seedSign(world, coord, spot, poi) },
    } as const;
    const moved = site && (site.tx !== spot.tx || site.ty !== spot.ty);
    return moved ? [{ drop: { tx: site.tx, ty: site.ty, kind: 'landmark' } } as const, put] : [put];
  },
  action: {
    input: naming,
    apply: (here, input) => {
      const site = siteOf(here);
      if (!site) return refuse('There is no landmark here to name.');
      const shown = wordsOf(site);
      return shown ? rename(here, site, shown, input) : nameUnposted(here, site, input);
    },
  },
});

type Naming = z.output<typeof naming>;

const namedBy = (here: Here, input: Extract<Naming, { op: 'name' }>) => ({
  name: input.name,
  ...(input.line ? { line: input.line } : {}),
  by: { id: here.me.id, name: here.me.name },
  at: here.now,
});

function rename(here: Here, site: Site, shown: Words, input: Naming) {
  const at = { tx: site.tx, ty: site.ty };
  const { named, ...unnamed } = site;
  if (!nearSite(site, here.me.pose))
    return refuse(`Stand by the ${LANDMARK_NOUNS[site.poi]}'s signpost to rename it.`);
  if (input.op === 'clear') {
    return named
      ? { ok: true as const, label: "Use the land's name", next: unnamed, at }
      : refuse("This place already carries the land's name.");
  }
  if (input.name === shown.name && (input.line || undefined) === shown.line)
    return refuse('That is already its name.');
  return {
    ok: true as const,
    label: 'Rename this place',
    next: { ...unnamed, named: namedBy(here, input) },
    at,
  };
}

function nameUnposted(here: Here, site: Site, input: Naming) {
  const at = { tx: site.tx, ty: site.ty };
  if (input.op === 'clear') return refuse('This place has no name to take off.');
  if (!inArea(site.area, centreTile(here.me.pose)))
    return refuse(`Stand in the ${LANDMARK_NOUNS[site.poi]} to name it.`);
  if (!isWalkable(here.place, at.tx, at.ty))
    return refuse('Something stands where the signpost goes.');
  return {
    ok: true as const,
    label: 'Name this place',
    next: { ...site, named: namedBy(here, input) },
    at,
  };
}
