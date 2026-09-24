import { decodeScreen } from './codec.ts';
import type { Screen } from './world.ts';

export const GARDEN_COORD = { sx: 0, sy: 0 } as const;

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
    v: 1,
    ...GARDEN_COORD,
    seed: 0,
    corners: CORNERS.join(''),
    features: FEATURES.join(''),
  });
}
