import { z } from 'zod';
import type { Tile } from '../../place.ts';
import { SCREEN_H, SCREEN_W, featureAt, type ScreenCoord, type World } from '../../world.ts';
import { tileHash } from '../hash.ts';
import { traceAt, traceKind, type TraceKind } from '../kind.ts';

export const EPITAPH_MAX = 60;

/** Folk of the land: who lies in a grave, and whose name a place may carry. */
export const NAMES = [
  'Ada',
  'Alder',
  'Barnaby',
  'Bram',
  'Clem',
  'Dingus',
  'Edna',
  'Ezra',
  'Fern',
  'Greta',
  'Gus',
  'Hattie',
  'Hollis',
  'Ivy',
  'Jasper',
  'Juniper',
  'Lark',
  'Mabel',
  'Maud',
  'Moss',
  'Ned',
  'Oona',
  'Otto',
  'Percy',
  'Pip',
  'Rosalind',
  'Rufus',
  'Silas',
  'Tilly',
  'Tobias',
  'Winnie',
  'Wren',
];

const PHRASES: readonly ((name: string) => string)[] = [
  (n) => `Here lies ${n}. Gone walking.`,
  (n) => `Here lies ${n}, who loved the rain.`,
  (n) => `${n} rests here at last.`,
  (n) => `Here lies ${n}. Still lost.`,
  (n) => `${n}, who always took the long way.`,
  (n) => `Here lies ${n}. Mind the step.`,
  (n) => `Here lies ${n}, fond of naps.`,
  (n) => `In memory of ${n}, a good neighbour.`,
  (n) => `${n}. Came for a visit, stayed.`,
  (n) => `Here lies ${n}. Told you I was ill.`,
  (n) => `${n}, who fed the crows.`,
  (n) => `Here lies ${n}. Back soon.`,
  (n) => `${n} knew every path by heart.`,
  (n) => `Rest well, ${n}.`,
  (n) => `Here lies ${n}, finder of lost things.`,
  (n) => `${n} sleeps. Do not wake them.`,
];

const hashOf = (world: World, coord: ScreenCoord, { tx, ty }: Tile) =>
  tileHash(coord, tx, ty, world.seed);

/** Who lies in a grave, the same for every player of a world. */
export const graveName = (world: World, coord: ScreenCoord, tile: Tile): string =>
  NAMES[hashOf(world, coord, tile) % NAMES.length]!;

/** The epitaph a grave shows until the language model writes one, or when it cannot. */
export function seedEpitaph(world: World, coord: ScreenCoord, tile: Tile): string {
  const phrase = PHRASES[(hashOf(world, coord, tile) >>> 8) % PHRASES.length]!;
  return phrase(graveName(world, coord, tile));
}

/**
 * Who wrote the words: `pending` is the seed epitaph waiting for the language model, `seed` is
 * the seed epitaph for good, after an admin cleared a written one.
 */
export const EPITAPH_SOURCES = ['pending', 'seed', 'model', 'admin'] as const;

const fields = {
  text: z.string().min(1).max(EPITAPH_MAX),
  source: z.enum(EPITAPH_SOURCES),
};

/** The words on a grave. Every grave gets one when its screen opens; the server may rewrite it. */
export const epitaph: TraceKind<'epitaph', typeof fields, never, never> = traceKind({
  kind: 'epitaph',
  fields,
  solid: () => false,
  look: () => ({ hidesFeature: false, recipe: undefined }),
  bubble: ({ text }) => ({ text }),
  readAt: 'faced',
  settle: (place, world) => {
    const { coord } = place.screen;
    const puts = [];
    for (let ty = 0; ty < SCREEN_H; ty++) {
      for (let tx = 0; tx < SCREEN_W; tx++) {
        if (featureAt(place.screen, tx, ty) !== 'grave') continue;
        if (traceAt(place, { tx, ty }, 'epitaph')) continue;
        const text = seedEpitaph(world, coord, { tx, ty });
        puts.push({ put: { kind: 'epitaph' as const, tx, ty, text, source: 'pending' as const } });
      }
    }
    return puts;
  },
});
