import { SCREEN_RECORD_VERSION, decodeScreen } from './codec.ts';
import { OVERWORLD, type Screen, type ScreenCoord } from './world.ts';

export const GARDEN_COORD: ScreenCoord = { layer: OVERWORLD, sx: 0, sy: 0 };

/** Where new players appear: on the south path, facing the pond. */
export const GARDEN_SPAWN = { x: 10 * 16, y: 12 * 16 + 10, dir: 'n' } as const;

/** Corner lattice: w water, s sand, d dirt, g grass. */
const CORNERS = [
  'gggggggggdddggggggggg',
  'gggggggggdddggggggggg',
  'gggggggggdddggggggggg',
  'gggggggggdddggggggggg',
  'gggggggggdddggggggggg',
  'gggggggsssssssggggggg',
  'dddddddswwwwwsddddddd',
  'dddddddswwwwwsddddddd',
  'dddddddswwwwwsddddddd',
  'dddddddswwwwwsddddddd',
  'gggggggsssssssggggggg',
  'gggggggggdddggggggggg',
  'gggggggggdddggggggggg',
  'gggggggggdddggggggggg',
  'gggggggggdddggggggggg',
  'gggggggggdddggggggggg',
];

/** Tiles: T tree, B bush, R rock, f flowers, t tall grass, . nothing. */
const FEATURES = [
  'TBBBBBBBB..BBBBBBBBT',
  'Bff..............ffB',
  'Bf..T..........T..fB',
  'B.....ff....ff.....B',
  'B.....f......f.....B',
  'B..t..............tB',
  '....................',
  '....................',
  '....................',
  'Bt................tB',
  'B.....f......f.....B',
  'B.....ff....ff.....B',
  'Bf..T..........T..fB',
  'Bff..............ffB',
  'TBBBBBBBB..BBBBBBBBT',
];

export function secretGarden(): Screen {
  return decodeScreen({
    v: SCREEN_RECORD_VERSION,
    ...GARDEN_COORD,
    biome: 'garden',
    corners: CORNERS.join(''),
    features: FEATURES.join(''),
  });
}
