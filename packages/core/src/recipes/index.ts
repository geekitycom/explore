import { createRng, type Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { bones, type BonesParams } from './bones.ts';
import { cactus, type CactusParams } from './cactus.ts';
import { fence, type FenceParams } from './fence.ts';
import { grave, type GraveParams } from './grave.ts';
import {
  bush,
  flower,
  grass,
  mushroom,
  reeds,
  type BushParams,
  type FlowerParams,
  type GrassParams,
  type MushroomParams,
  type ReedsParams,
} from './props.ts';
import { rock, type RockParams } from './rock.ts';
import { rosette, type RosetteParams } from './rosette.ts';
import { tree, type TreeParams } from './tree.ts';

export { clamp } from './draw.ts';
export { LINK } from './fence.ts';

export type {
  BonesParams,
  BushParams,
  CactusParams,
  FenceParams,
  FlowerParams,
  GrassParams,
  GraveParams,
  MushroomParams,
  ReedsParams,
  RockParams,
  RosetteParams,
  TreeParams,
};

type FamilyParams = {
  tree: TreeParams;
  bush: BushParams;
  rock: RockParams;
  flower: FlowerParams;
  grass: GrassParams;
  cactus: CactusParams;
  reeds: ReedsParams;
  mushroom: MushroomParams;
  rosette: RosetteParams;
  fence: FenceParams;
  bones: BonesParams;
  grave: GraveParams;
};

export type Family = keyof FamilyParams;

/** A species: a family and the params that make it, say, an oak rather than a beech. */
export type Recipe = {
  [F in Family]: { readonly family: F; readonly params: FamilyParams[F] };
}[Family];

const FAMILIES: { [F in Family]: (params: FamilyParams[F], rng: Rng) => Sprite } = {
  tree,
  bush,
  rock,
  flower,
  grass,
  cactus,
  reeds,
  mushroom,
  rosette,
  fence,
  bones,
  grave,
};

export const RECIPE_FAMILIES = Object.keys(FAMILIES) as Family[];

/** Pure: the same recipe and seed always give the same pixels. */
export function drawRecipe(recipe: Recipe, seed: number): Sprite {
  const draw = FAMILIES[recipe.family] as (params: Recipe['params'], rng: Rng) => Sprite;
  return draw(recipe.params, createRng(seed));
}

/** One example species per family, for the gallery and tests. */
export const SAMPLE_RECIPES: { [F in Family]: Recipe & { family: F } } = {
  tree: {
    family: 'tree',
    params: { shape: 'broadleaf', leaves: 'grass', bark: 'bark', tiles: 2, spread: 14, trunk: 5 },
  },
  bush: { family: 'bush', params: { leaves: 'grass' } },
  rock: { family: 'rock', params: { stone: 'stone', size: 1 } },
  flower: {
    family: 'flower',
    params: { petals: 'poppy', leaves: 'grass', centre: 'gold', blossoms: 3 },
  },
  grass: { family: 'grass', params: { blades: 'grass', height: 10 } },
  cactus: { family: 'cactus', params: { shape: 'column', skin: 'cactus', tiles: 2, arms: 2 } },
  reeds: { family: 'reeds', params: { stems: 'straw', heads: 'bark', tiles: 2 } },
  mushroom: {
    family: 'mushroom',
    params: { cap: 'poppy', stem: 'sand', spots: 'snow', cluster: 3 },
  },
  rosette: { family: 'rosette', params: { leaves: 'sage' } },
  fence: { family: 'fence', params: { style: 'picket', material: 'snow', links: 0 } },
  bones: { family: 'bones', params: { form: 'scatter', bone: 'sand' } },
  grave: {
    family: 'grave',
    params: { form: 'headstone', material: 'stone', earth: 'grass', moss: 'sage' },
  },
};
