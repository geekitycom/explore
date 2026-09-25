import type { RampName } from './palette.ts';
import type { BonesParams, GraveParams, Recipe, TreeParams } from './recipes/index.ts';
import type { Biome, Feature, FenceFeature } from './world.ts';

export type PlacedFeature = Exclude<Feature, 'none'>;

/** A feature the flora catalogue fills with a species; fences are built, not grown. */
export type Plant = Exclude<PlacedFeature, FenceFeature>;

/** A plant or stone modelled on a real one. */
export type Species = {
  readonly name: string;
  readonly recipe: Recipe;
  /** How often it is picked among its feature's species, relative to the others; 1 if absent. */
  readonly weight?: number;
  /** Drops petals. */
  readonly sheds?: boolean;
};

/** What stands on a tile holding each feature, per biome. The generator decides where features go. */
export type Flora = Readonly<Record<Plant, readonly Species[]>>;

const oak: Species = {
  name: 'English oak',
  recipe: {
    family: 'tree',
    params: { shape: 'broadleaf', leaves: 'grass', bark: 'bark', tiles: 2, spread: 13, trunk: 5 },
  },
};
const beech: Species = {
  name: 'European beech',
  recipe: {
    family: 'tree',
    params: { shape: 'broadleaf', leaves: 'grass', bark: 'stone', tiles: 2, spread: 10, trunk: 7 },
  },
};
const spruce: Species = {
  name: 'Norway spruce',
  recipe: {
    family: 'tree',
    params: { shape: 'conifer', leaves: 'pine', bark: 'bark', tiles: 2, spread: 11, trunk: 3 },
  },
};
const hazel: Species = { name: 'Hazel', recipe: { family: 'bush', params: { leaves: 'grass' } } };
const hawthorn: Species = {
  name: 'Hawthorn',
  recipe: { family: 'bush', params: { leaves: 'grass', berries: 'poppy' } },
};
const poppy: Species = {
  name: 'Common poppy',
  recipe: {
    family: 'flower',
    params: { petals: 'poppy', leaves: 'grass', centre: 'gold', blossoms: 3 },
  },
};
const daisy: Species = {
  name: 'Oxeye daisy',
  recipe: {
    family: 'flower',
    params: { petals: 'snow', leaves: 'grass', centre: 'gold', blossoms: 4 },
  },
};
const cornflower: Species = {
  name: 'Cornflower',
  recipe: { family: 'flower', params: { petals: 'water', leaves: 'grass', blossoms: 3 } },
};
const meadowGrass: Species = {
  name: 'Meadow grass',
  recipe: { family: 'grass', params: { blades: 'grass', height: 10 } },
};
const fieldstone: Species = {
  name: 'Fieldstone',
  recipe: { family: 'rock', params: { stone: 'stone', size: 1 } },
};
const mossyBoulder: Species = {
  name: 'Mossy boulder',
  recipe: { family: 'rock', params: { stone: 'stone', moss: 'grass', size: 0.8 } },
};
const saguaro: Species = {
  name: 'Saguaro',
  recipe: { family: 'cactus', params: { shape: 'column', skin: 'cactus', tiles: 2, arms: 2 } },
};
const juniper: Species = {
  name: 'Common juniper',
  recipe: { family: 'bush', params: { leaves: 'pine' } },
};
const flyAgaric: Species = {
  name: 'Fly agaric',
  recipe: { family: 'mushroom', params: { cap: 'poppy', stem: 'snow', spots: 'snow', cluster: 3 } },
};

/** Bleached bones. Every biome lists them, but only biomes with BIOME_PARAMS.bones ever show them. */
function remains(bone: RampName): Species[] {
  const of = (name: string, form: BonesParams['form'], weight: number): Species => ({
    name,
    recipe: { family: 'bones', params: { form, bone } },
    weight,
  });
  return [
    of('Cattle skull', 'cattle', 2),
    of('Ram skull', 'ram', 1),
    of('Scattered bones', 'scatter', 3),
    of('Rib cage', 'ribs', 2),
  ];
}

/** Grave markers, grown over with the biome's turf and weathered in its stone and wood. */
function graves(m: {
  stone: RampName;
  wood: RampName;
  turf: RampName;
  soil: RampName;
  moss?: RampName;
}): Species[] {
  const moss = m.moss ? { moss: m.moss } : {};
  const of = (name: string, weight: number, params: GraveParams): Species => ({
    name,
    recipe: { family: 'grave', params },
    weight,
  });
  return [
    of('Headstone', 4, { form: 'headstone', material: m.stone, earth: m.turf, ...moss }),
    of('Wooden cross', 3, { form: 'cross', material: m.wood, earth: m.turf }),
    of('Cairn', 1, { form: 'cairn', material: m.stone, earth: m.turf, ...moss }),
    of('Open grave', 1, { form: 'open', material: m.wood, earth: m.soil }),
  ];
}

function bigtree(name: string, params: Omit<TreeParams, 'tiles'>): Species {
  return { name, recipe: { family: 'tree', params: { ...params, tiles: 3 } } };
}

/**
 * The species catalogue: real plants and stones each biome's scenery is modelled on (doc-4).
 * Every biome lists every feature, since a biome's border screens can hold a neighbour's features.
 */
export const FLORA: Readonly<Record<Biome, Flora>> = {
  garden: {
    tree: [
      { ...oak, weight: 2 },
      beech,
      { ...spruce, weight: 2 },
      {
        name: 'Japanese cherry',
        recipe: {
          family: 'tree',
          params: {
            shape: 'broadleaf',
            leaves: 'rose',
            bark: 'bark',
            tiles: 2,
            spread: 11,
            trunk: 6,
          },
        },
        sheds: true,
      },
    ],
    bush: [{ ...hazel, weight: 2 }, hawthorn],
    rock: [fieldstone, mossyBoulder],
    flowers: [poppy, daisy, cornflower],
    tallgrass: [meadowGrass],
    bigtree: [
      bigtree('Veteran oak', {
        shape: 'broadleaf',
        leaves: 'grass',
        bark: 'bark',
        spread: 15,
        trunk: 9,
      }),
    ],
    bones: remains('stone'),
    grave: graves({ stone: 'stone', wood: 'bark', turf: 'grass', soil: 'bark', moss: 'grass' }),
  },
  meadow: {
    tree: [
      { ...oak, weight: 3 },
      {
        name: 'Ash',
        recipe: {
          family: 'tree',
          params: {
            shape: 'broadleaf',
            leaves: 'grass',
            bark: 'stone',
            tiles: 2,
            spread: 9,
            trunk: 8,
          },
        },
      },
    ],
    bush: [{ ...hazel, weight: 2 }, hawthorn],
    rock: [
      fieldstone,
      {
        name: 'Mossy fieldstone',
        recipe: { family: 'rock', params: { stone: 'stone', moss: 'grass', size: 0.6 } },
      },
    ],
    flowers: [
      { ...poppy, weight: 2 },
      { ...daisy, weight: 2 },
      cornflower,
      {
        name: 'Meadow buttercup',
        recipe: { family: 'flower', params: { petals: 'gold', leaves: 'grass', blossoms: 3 } },
      },
    ],
    tallgrass: [
      { ...meadowGrass, weight: 2 },
      {
        name: 'Meadow foxtail',
        recipe: { family: 'grass', params: { blades: 'grass', tips: 'gold', height: 11 } },
      },
    ],
    bigtree: [
      bigtree('Veteran oak', {
        shape: 'broadleaf',
        leaves: 'grass',
        bark: 'bark',
        spread: 15,
        trunk: 9,
      }),
    ],
    bones: remains('stone'),
    grave: graves({ stone: 'stone', wood: 'bark', turf: 'grass', soil: 'bark', moss: 'grass' }),
  },
  forest: {
    tree: [{ ...beech, weight: 3 }, oak, { ...spruce, weight: 2 }],
    bush: [
      { ...hazel, weight: 2 },
      { name: 'Holly', recipe: { family: 'bush', params: { leaves: 'pine', berries: 'poppy' } } },
    ],
    rock: [
      mossyBoulder,
      {
        name: 'Mossy stone',
        recipe: { family: 'rock', params: { stone: 'stone', moss: 'pine', size: 0.4 } },
      },
    ],
    flowers: [
      {
        name: 'Wood anemone',
        recipe: { family: 'flower', params: { petals: 'peach', leaves: 'grass', blossoms: 4 } },
        weight: 2,
      },
      flyAgaric,
      {
        name: 'Penny bun',
        recipe: { family: 'mushroom', params: { cap: 'bark', stem: 'peach', cluster: 2 } },
      },
    ],
    tallgrass: [
      {
        name: 'Bracken',
        recipe: { family: 'grass', params: { blades: 'pine', height: 11 } },
      },
    ],
    bigtree: [
      bigtree('Ancient beech', {
        shape: 'broadleaf',
        leaves: 'grass',
        bark: 'stone',
        spread: 15,
        trunk: 10,
      }),
    ],
    bones: remains('stone'),
    grave: graves({ stone: 'stone', wood: 'bark', turf: 'grass', soil: 'bark', moss: 'pine' }),
  },
  lakeland: {
    tree: [
      {
        name: 'White willow',
        recipe: {
          family: 'tree',
          params: {
            shape: 'weeping',
            leaves: 'grass',
            bark: 'bark',
            tiles: 2,
            spread: 15,
            trunk: 6,
          },
        },
        weight: 2,
      },
      {
        name: 'Black alder',
        recipe: {
          family: 'tree',
          params: {
            shape: 'broadleaf',
            leaves: 'grass',
            bark: 'stone',
            tiles: 3,
            spread: 8,
            trunk: 12,
          },
        },
      },
    ],
    bush: [
      { name: 'Grey willow', recipe: { family: 'bush', params: { leaves: 'grass' } }, weight: 2 },
      {
        name: 'Dog rose',
        recipe: { family: 'bush', params: { leaves: 'grass', berries: 'rose' } },
      },
    ],
    rock: [
      { name: 'Lake cobble', recipe: { family: 'rock', params: { stone: 'stone', size: 0.4 } } },
    ],
    flowers: [
      {
        name: 'Yellow flag iris',
        recipe: { family: 'flower', params: { petals: 'gold', leaves: 'grass', blossoms: 3 } },
        weight: 2,
      },
      {
        name: 'Purple loosestrife',
        recipe: { family: 'flower', params: { petals: 'rose', leaves: 'grass', blossoms: 4 } },
      },
      {
        name: 'Water forget-me-not',
        recipe: {
          family: 'flower',
          params: { petals: 'water', leaves: 'grass', centre: 'gold', blossoms: 4 },
        },
      },
    ],
    tallgrass: [
      {
        name: 'Common reed',
        recipe: { family: 'reeds', params: { stems: 'straw', tiles: 2 } },
        weight: 2,
      },
      {
        name: 'Bulrush',
        recipe: { family: 'reeds', params: { stems: 'straw', heads: 'bark', tiles: 2 } },
        weight: 2,
      },
      {
        name: 'Tussock sedge',
        recipe: { family: 'grass', params: { blades: 'grass', height: 8 } },
      },
    ],
    bigtree: [
      bigtree('Old white willow', {
        shape: 'weeping',
        leaves: 'grass',
        bark: 'bark',
        spread: 15,
        trunk: 8,
      }),
    ],
    bones: remains('stone'),
    grave: graves({ stone: 'stone', wood: 'bark', turf: 'grass', soil: 'bark', moss: 'grass' }),
  },
  scrubland: {
    tree: [
      {
        name: 'Utah juniper',
        recipe: {
          family: 'tree',
          params: { shape: 'conifer', leaves: 'sage', bark: 'bark', tiles: 2, spread: 8, trunk: 3 },
        },
        weight: 2,
      },
      {
        name: 'Holm oak',
        recipe: {
          family: 'tree',
          params: {
            shape: 'broadleaf',
            leaves: 'pine',
            bark: 'bark',
            tiles: 2,
            spread: 10,
            trunk: 4,
          },
        },
      },
    ],
    bush: [
      { name: 'Big sagebrush', recipe: { family: 'bush', params: { leaves: 'sage' } }, weight: 3 },
      { name: 'Kermes oak', recipe: { family: 'bush', params: { leaves: 'pine' } } },
    ],
    rock: [
      {
        name: 'Limestone',
        recipe: { family: 'rock', params: { stone: 'stone', size: 0.9 } },
        weight: 2,
      },
      {
        name: 'Lichen-flecked limestone',
        recipe: { family: 'rock', params: { stone: 'stone', moss: 'sage', size: 0.5 } },
      },
    ],
    flowers: [
      {
        name: 'Lavender',
        recipe: { family: 'flower', params: { petals: 'heather', leaves: 'sage', blossoms: 4 } },
      },
      {
        name: 'Rockrose',
        recipe: { family: 'flower', params: { petals: 'rose', leaves: 'sage', blossoms: 3 } },
      },
    ],
    tallgrass: [
      {
        name: 'Needle grass',
        recipe: { family: 'grass', params: { blades: 'straw', height: 10 } },
        weight: 2,
      },
      { name: 'Blue grama', recipe: { family: 'grass', params: { blades: 'sage', height: 7 } } },
    ],
    bigtree: [
      bigtree('Old holm oak', {
        shape: 'broadleaf',
        leaves: 'pine',
        bark: 'bark',
        spread: 15,
        trunk: 8,
      }),
    ],
    bones: remains('stone'),
    grave: graves({ stone: 'stone', wood: 'bark', turf: 'straw', soil: 'bark', moss: 'sage' }),
  },
  desert: {
    tree: [
      { ...saguaro, weight: 2 },
      {
        name: 'Joshua tree',
        recipe: {
          family: 'tree',
          params: {
            shape: 'broadleaf',
            leaves: 'cactus',
            bark: 'sand',
            tiles: 2,
            spread: 8,
            trunk: 8,
          },
        },
      },
    ],
    bush: [
      { ...saguaro, weight: 2 },
      {
        name: 'Barrel cactus',
        recipe: { family: 'cactus', params: { shape: 'barrel', skin: 'cactus', crown: 'straw' } },
        weight: 2,
      },
      { name: 'Creosote bush', recipe: { family: 'bush', params: { leaves: 'sage' } }, weight: 2 },
      { name: 'Agave', recipe: { family: 'rosette', params: { leaves: 'sage' } } },
    ],
    rock: [
      {
        name: 'Sandstone',
        recipe: { family: 'rock', params: { stone: 'sand', size: 1 } },
        weight: 2,
      },
      { name: 'Desert pebble', recipe: { family: 'rock', params: { stone: 'sand', size: 0.3 } } },
    ],
    flowers: [
      {
        name: 'Desert marigold',
        recipe: { family: 'flower', params: { petals: 'straw', leaves: 'sage', blossoms: 3 } },
      },
    ],
    tallgrass: [
      {
        name: 'Galleta grass',
        recipe: { family: 'grass', params: { blades: 'straw', height: 6 } },
      },
    ],
    bigtree: [
      {
        name: 'Giant saguaro',
        recipe: {
          family: 'cactus',
          params: { shape: 'column', skin: 'cactus', tiles: 2, arms: 3 },
        },
      },
    ],
    bones: remains('sand'),
    grave: graves({ stone: 'sage', wood: 'sand', turf: 'sand', soil: 'sand' }),
  },
  highlands: {
    tree: [
      {
        name: 'Scots pine',
        recipe: {
          family: 'tree',
          params: {
            shape: 'conifer',
            leaves: 'pine',
            bark: 'bark',
            tiles: 3,
            spread: 10,
            trunk: 12,
          },
        },
        weight: 3,
      },
      {
        name: 'Rowan',
        recipe: {
          family: 'tree',
          params: {
            shape: 'broadleaf',
            leaves: 'pine',
            bark: 'granite',
            tiles: 2,
            spread: 8,
            trunk: 6,
          },
        },
      },
    ],
    bush: [
      { name: 'Heather', recipe: { family: 'bush', params: { leaves: 'heather' } }, weight: 3 },
      {
        name: 'Gorse',
        recipe: { family: 'bush', params: { leaves: 'pine', berries: 'gold' } },
        weight: 2,
      },
      juniper,
    ],
    rock: [
      {
        name: 'Granite outcrop',
        recipe: { family: 'rock', params: { stone: 'granite', size: 1 } },
        weight: 2,
      },
      {
        name: 'Lichen-covered granite',
        recipe: { family: 'rock', params: { stone: 'granite', moss: 'gold', size: 0.6 } },
      },
    ],
    flowers: [
      {
        name: 'Bell heather',
        recipe: { family: 'flower', params: { petals: 'heather', leaves: 'pine', blossoms: 4 } },
        weight: 2,
      },
      {
        name: 'Bog asphodel',
        recipe: { family: 'flower', params: { petals: 'gold', leaves: 'pine', blossoms: 3 } },
      },
    ],
    tallgrass: [
      {
        name: 'Purple moor grass',
        recipe: { family: 'grass', params: { blades: 'pine', tips: 'heather', height: 10 } },
      },
      { name: 'Deer grass', recipe: { family: 'grass', params: { blades: 'gold', height: 8 } } },
    ],
    bigtree: [
      bigtree('Granny pine', {
        shape: 'conifer',
        leaves: 'pine',
        bark: 'bark',
        spread: 15,
        trunk: 8,
      }),
    ],
    bones: remains('granite'),
    grave: graves({ stone: 'granite', wood: 'bark', turf: 'pine', soil: 'bark', moss: 'gold' }),
  },
  taiga: {
    tree: [
      { ...spruce, weight: 3 },
      {
        name: 'Siberian larch',
        recipe: {
          family: 'tree',
          params: {
            shape: 'conifer',
            leaves: 'gold',
            bark: 'bark',
            tiles: 2,
            spread: 10,
            trunk: 4,
          },
        },
        weight: 2,
      },
      {
        name: 'Silver birch',
        recipe: {
          family: 'tree',
          params: {
            shape: 'broadleaf',
            leaves: 'pine',
            bark: 'snow',
            tiles: 2,
            spread: 8,
            trunk: 8,
          },
        },
      },
    ],
    bush: [
      {
        name: 'Lingonberry',
        recipe: { family: 'bush', params: { leaves: 'pine', berries: 'poppy' } },
        weight: 2,
      },
      juniper,
    ],
    rock: [
      {
        name: 'Glacial boulder',
        recipe: { family: 'rock', params: { stone: 'stone', moss: 'pine', size: 1 } },
      },
    ],
    flowers: [
      {
        name: 'Chanterelle',
        recipe: { family: 'mushroom', params: { cap: 'gold', stem: 'gold', cluster: 3 } },
      },
      flyAgaric,
    ],
    tallgrass: [
      {
        name: 'Wood horsetail',
        recipe: { family: 'grass', params: { blades: 'pine', height: 9 } },
      },
    ],
    bigtree: [
      bigtree('Old spruce', {
        shape: 'conifer',
        leaves: 'pine',
        bark: 'bark',
        spread: 15,
        trunk: 6,
      }),
    ],
    bones: remains('snow'),
    grave: graves({ stone: 'stone', wood: 'bark', turf: 'snow', soil: 'bark', moss: 'pine' }),
  },
  tundra: {
    tree: [
      {
        name: 'Dwarf birch',
        recipe: {
          family: 'tree',
          params: {
            shape: 'broadleaf',
            leaves: 'sage',
            bark: 'snow',
            tiles: 2,
            spread: 6,
            trunk: 3,
          },
        },
        weight: 2,
      },
      {
        name: 'Stunted spruce',
        recipe: {
          family: 'tree',
          params: {
            shape: 'conifer',
            leaves: 'sage',
            bark: 'stone',
            tiles: 2,
            spread: 7,
            trunk: 2,
          },
        },
      },
    ],
    bush: [
      { name: 'Dwarf willow', recipe: { family: 'bush', params: { leaves: 'sage' } }, weight: 2 },
      {
        name: 'Crowberry',
        recipe: { family: 'bush', params: { leaves: 'sage', berries: 'stone' } },
      },
    ],
    rock: [
      {
        name: 'Lichen-covered boulder',
        recipe: { family: 'rock', params: { stone: 'stone', moss: 'sage', size: 0.8 } },
        weight: 2,
      },
      { name: 'Glacial erratic', recipe: { family: 'rock', params: { stone: 'stone', size: 1 } } },
    ],
    flowers: [
      {
        name: 'Mountain avens',
        recipe: { family: 'flower', params: { petals: 'snow', leaves: 'sage', blossoms: 3 } },
      },
    ],
    tallgrass: [
      {
        name: 'Cotton grass',
        recipe: { family: 'grass', params: { blades: 'sage', tips: 'snow', height: 10 } },
      },
    ],
    bigtree: [
      bigtree('Lone spruce', {
        shape: 'conifer',
        leaves: 'sage',
        bark: 'stone',
        spread: 12,
        trunk: 6,
      }),
    ],
    bones: remains('snow'),
    grave: graves({ stone: 'stone', wood: 'sage', turf: 'snow', soil: 'stone', moss: 'sage' }),
  },
};

/** The species on a tile, from a hash of the tile: heavier species win more often. */
export function speciesAt(biome: Biome, feature: Plant, hash: number): Species {
  const species = FLORA[biome][feature];
  let roll = hash % species.reduce((sum, s) => sum + (s.weight ?? 1), 0);
  for (const s of species) {
    roll -= s.weight ?? 1;
    if (roll < 0) return s;
  }
  return species[0]!;
}
