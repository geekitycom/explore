import type { Species } from './flora.ts';
import type { RampName } from './palette.ts';
import { LINK } from './recipes/index.ts';
import {
  DIRS,
  DIR_DELTA,
  FENCES,
  featureAt,
  inScreen,
  type Feature,
  type Fence,
  type FenceFeature,
  type Screen,
} from './world.ts';

/** What each fence is called and built from. */
export const FENCE_KINDS: Readonly<Record<Fence, { readonly name: string; material: RampName }>> = {
  picket: { name: 'Picket fence', material: 'snow' },
  splitrail: { name: 'Split-rail fence', material: 'bark' },
  railing: { name: 'Iron railing', material: 'stone' },
  drystone: { name: 'Dry-stone wall', material: 'stone' },
};

type FenceTile = { readonly fence: Fence; readonly broken: boolean };

export function brokenFence(fence: Fence): FenceFeature {
  return `${fence}-broken`;
}

const FENCE_TILES: ReadonlyMap<Feature, FenceTile> = new Map(
  FENCES.flatMap((fence): [Feature, FenceTile][] => [
    [fence, { fence, broken: false }],
    [brokenFence(fence), { fence, broken: true }],
  ]),
);

/** The fence a tile holds, and whether it is broken; undefined for any other feature. */
export function fenceOf(feature: Feature): FenceTile | undefined {
  return FENCE_TILES.get(feature);
}

export function isFence(feature: Feature): feature is FenceFeature {
  return fenceOf(feature) !== undefined;
}

/**
 * The LINK bits of the neighbours holding the same fence, whole or broken. A fence never joins
 * across a screen edge; the generator keeps fences off edge tiles, so seams need no neighbour.
 */
export function fenceLinks(screen: Screen, tx: number, ty: number): number {
  const own = fenceOf(featureAt(screen, tx, ty))?.fence;
  let links = 0;
  for (const dir of DIRS) {
    const nx = tx + DIR_DELTA[dir].dx;
    const ny = ty + DIR_DELTA[dir].dy;
    if (inScreen(nx, ny) && own && fenceOf(featureAt(screen, nx, ny))?.fence === own) {
      links |= LINK[dir];
    }
  }
  return links;
}

const species = new Map<string, Species>();

/** The fence piece for a tile, the same object for the same feature and links. */
export function fenceSpecies(feature: FenceFeature, links: number): Species {
  const key = `${feature}/${links}`;
  let s = species.get(key);
  if (!s) {
    const { fence, broken } = fenceOf(feature)!;
    const { name, material } = FENCE_KINDS[fence];
    s = {
      name: broken ? `Broken ${name.toLowerCase()}` : name,
      recipe: { family: 'fence', params: { style: fence, material, broken, links } },
    };
    species.set(key, s);
  }
  return s;
}
