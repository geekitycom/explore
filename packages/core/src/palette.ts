/** An opaque colour as uppercase `#RRGGBB`. */
export type Hex = `#${string}`;

/** The dark outline around every object sprite. Never used on ground. */
export const OUTLINE: Hex = '#141B1B';

/**
 * The master palette as named ramps, each ordered dark to light. Ramps share colours where
 * materials meet. Every shipped or generated pixel is `OUTLINE` or a colour from a ramp.
 */
export const RAMPS = {
  grass: ['#345A52', '#56864C', '#74A334', '#ADBC3A', '#D5D66B'],
  pine: ['#23403C', '#345A52', '#4A7F4B', '#74A334'],
  cactus: ['#2A4B3F', '#3F6E4C', '#56864C', '#7FA24A', '#ADBC3A'],
  sage: ['#345A52', '#5F7160', '#8D977F', '#ABC2BC'],
  straw: ['#6B6A2C', '#A8A129', '#D2B37D', '#F1C471'],
  bark: ['#3B3643', '#7B473C', '#965340', '#A3754E', '#BD7959'],
  soil: ['#4E484A', '#695953', '#816855', '#90775E', '#B3957F'],
  sand: ['#7B473C', '#965340', '#BD7959', '#C8966B', '#D2B37D', '#EECF9B'],
  dune: ['#965340', '#D78B4A', '#EF914F', '#FFAD5D', '#FFCB8D', '#FCE2CA'],
  stone: ['#3B3643', '#4E484A', '#5F7160', '#8D977F', '#ABC2BC'],
  granite: ['#3B3643', '#695953', '#8E7C73', '#B3957F', '#D2C9C9'],
  heather: ['#543C52', '#8F3E56', '#A5608B', '#D3A2C0'],
  snow: ['#7C88B8', '#A4B8DA', '#B8DCE5', '#F2EAF1', '#FFFFFF'],
  water: ['#4A5270', '#2D697B', '#548789', '#79B8CE', '#71DDEE', '#8FEFF1'],
  poppy: ['#8F3E56', '#D14B34', '#E46D3A', '#FF9554'],
  rose: ['#8F3E56', '#E0394C', '#CF736D', '#EF9597', '#FFCBA9'],
  gold: ['#9C6546', '#D78B4A', '#F1C471', '#FFE18D'],
  peach: ['#9C6546', '#D3865F', '#F2AD7D', '#FFBC75', '#FFCBA9', '#FCE2CA'],
} as const satisfies Record<string, readonly Hex[]>;

export type RampName = keyof typeof RAMPS;

/** Every colour in the master palette, `OUTLINE` first, then ramp colours in first-seen order. */
export const PALETTE: readonly Hex[] = [...new Set<Hex>([OUTLINE, ...Object.values(RAMPS).flat()])];

export const PALETTE_BIOMES = [
  'meadow',
  'forest',
  'lakeland',
  'scrubland',
  'desert',
  'highlands',
  'taiga',
  'tundra',
] as const;

export type PaletteBiome = (typeof PALETTE_BIOMES)[number];

/** The ramps a biome draws its ground and its flora (plants and rocks) from. */
export const BIOME_RAMPS: Record<
  PaletteBiome,
  { readonly ground: readonly RampName[]; readonly flora: readonly RampName[] }
> = {
  meadow: { ground: ['grass', 'soil'], flora: ['grass', 'bark', 'poppy', 'water', 'gold'] },
  forest: { ground: ['pine', 'soil'], flora: ['grass', 'pine', 'bark', 'stone', 'peach'] },
  lakeland: { ground: ['grass', 'sand', 'water'], flora: ['grass', 'straw', 'bark', 'rose'] },
  scrubland: { ground: ['straw', 'soil'], flora: ['sage', 'pine', 'straw', 'bark', 'stone'] },
  desert: { ground: ['dune', 'sand'], flora: ['cactus', 'sage', 'straw', 'sand'] },
  highlands: {
    ground: ['grass', 'soil', 'granite'],
    flora: ['pine', 'bark', 'heather', 'gold', 'granite'],
  },
  taiga: { ground: ['snow', 'pine'], flora: ['pine', 'bark', 'gold', 'poppy'] },
  tundra: { ground: ['snow', 'stone'], flora: ['sage', 'snow', 'stone'] },
};
