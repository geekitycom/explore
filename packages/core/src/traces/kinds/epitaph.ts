import { z } from 'zod';
import type { Tile } from '../../place.ts';
import { SCREEN_H, SCREEN_W, featureAt, type ScreenCoord, type World } from '../../world.ts';
import { tileHash } from '../hash.ts';
import { traceAt, traceKind, type TraceKind } from '../kind.ts';

export const EPITAPH_MAX = 60;

/** Folk of the land: who lies in a grave, and whose name a place may carry. */
export const NAMES = [
  'Ada',
  'Agnes',
  'Alder',
  'Ambrose',
  'Arlo',
  'Ash',
  'Aster',
  'Augustus',
  'Barnaby',
  'Basil',
  'Beatrix',
  'Birdie',
  'Bram',
  'Bramble',
  'Briar',
  'Cecil',
  'Cedar',
  'Clem',
  'Clover',
  'Cora',
  'Cosmo',
  'Dahlia',
  'Delphine',
  'Dingus',
  'Dorothea',
  'Dot',
  'Edna',
  'Elowen',
  'Elsie',
  'Emmett',
  'Esme',
  'Ezra',
  'Ferdinand',
  'Fern',
  'Finch',
  'Florian',
  'Flossie',
  'Gideon',
  'Ginger',
  'Greta',
  'Gus',
  'Hattie',
  'Hazel',
  'Heath',
  'Hollis',
  'Horace',
  'Humphrey',
  'Ida',
  'Ines',
  'Iris',
  'Ivy',
  'Jasper',
  'Jonah',
  'Jude',
  'Juniper',
  'Kit',
  'Lark',
  'Linus',
  'Lottie',
  'Lulu',
  'Mabel',
  'Marigold',
  'Maud',
  'Merritt',
  'Milo',
  'Minnie',
  'Mortimer',
  'Moss',
  'Myrtle',
  'Ned',
  'Nell',
  'Nettle',
  'Olive',
  'Oona',
  'Orla',
  'Otto',
  'Ottoline',
  'Pansy',
  'Pearl',
  'Percy',
  'Pim',
  'Pip',
  'Posy',
  'Quill',
  'Quincy',
  'Rook',
  'Rosalind',
  'Rowan',
  'Rufus',
  'Saffron',
  'Sage',
  'Silas',
  'Sorrel',
  'Tansy',
  'Thaddeus',
  'Thistle',
  'Tilly',
  'Tobias',
  'Tuck',
  'Ursula',
  'Vera',
  'Violet',
  'Wilfred',
  'Wilhelmina',
  'Winnie',
  'Winslow',
  'Wren',
  'Yarrow',
  'Zeb',
  'Zinnia',
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
  (n) => `${n}. Left the kettle on.`,
  (n) => `Beloved ${n}. Better at soup than at goodbyes.`,
  (n) => `${n} planted this tree. Sit a while.`,
  (n) => `Gone ahead to find the good spot. ${n}`,
  (n) => `${n}, keeper of bees and grudges.`,
  (n) => `Sweet dreams, ${n}. The stars are out.`,
  (n) => `${n} never met a puddle they didn't jump.`,
  (n) => `Whistled badly, loved well. ${n}`,
  (n) => `${n}. Owed nobody, lent everyone.`,
  (n) => `Beneath this stone, ${n} and a good book.`,
  (n) => `${n} is out picking berries.`,
  (n) => `Say hello to ${n} on your way past.`,
  (n) => `${n}, who counted every sunrise.`,
  (n) => `Dear ${n}. The dog still waits.`,
  (n) => `${n}. Asked the moon a question once.`,
  (n) => `Here ${n} put down their pack.`,
  (n) => `${n} knew the name of every bird.`,
  (n) => `${n}. Wrong about the weather, right about us.`,
  (n) => `Gone fishing forever. ${n}`,
  (n) => `${n}, maker of very lumpy quilts.`,
  (n) => `Hush now. ${n} is listening to the wind.`,
  (n) => `${n} sang to the turnips. They grew.`,
  (n) => `The last of the lanterns: ${n}.`,
  (n) => `${n}. Always one more story.`,
  (n) => `Pardon the mess. ${n} was mid-project.`,
  (n) => `${n} traded it all for a quiet hill.`,
  (n) => `Rest, ${n}. The garden is in good hands.`,
  (n) => `${n}, who could fix anything but a sulk.`,
  (n) => `Leave a pebble for ${n}.`,
  (n) => `${n}. Late to everything, even this.`,
  (n) => `${n} followed a butterfly and kept going.`,
  (n) => `Missed by the moths and the mice. ${n}`,
  (n) => `${n}, who shared their last biscuit.`,
  (n) => `Somewhere past the hills, ${n} is still walking.`,
];

const hashOf = (world: World, coord: ScreenCoord, { tx, ty }: Tile) =>
  tileHash(coord, tx, ty, world.seed);

/** The epitaph a grave shows until the language model writes one, or when it cannot. */
export function seedEpitaph(
  world: World,
  coord: ScreenCoord,
  grave: Tile & { readonly name: string },
): string {
  const phrase = PHRASES[(hashOf(world, coord, grave) >>> 8) % PHRASES.length]!;
  return phrase(grave.name);
}

/**
 * Who wrote the words: `pending` is the seed epitaph waiting for the language model, `seed` is
 * the seed epitaph for good, after an admin cleared a written one.
 */
export const EPITAPH_SOURCES = ['pending', 'seed', 'model', 'admin'] as const;

const fields = {
  name: z.string().min(1),
  text: z.string().min(1).max(EPITAPH_MAX),
  source: z.enum(EPITAPH_SOURCES),
};

/**
 * Who lies in a grave and the words on it. Every grave gets one when its screen opens, naming
 * its person from `NAMES` for good; the server may rewrite the words, never the name.
 */
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
        const grave = { tx, ty, name: NAMES[hashOf(world, coord, { tx, ty }) % NAMES.length]! };
        const text = seedEpitaph(world, coord, grave);
        puts.push({
          put: { kind: 'epitaph' as const, ...grave, text, source: 'pending' as const },
        });
      }
    }
    return puts;
  },
});
