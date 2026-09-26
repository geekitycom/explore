import { SCREEN_RECORD_VERSION, decodeScreen } from './codec.ts';
import { OVERWORLD, type Screen, type ScreenCoord } from './world.ts';

export const GARDEN_COORD: ScreenCoord = { layer: OVERWORLD, sx: 0, sy: 0 };

/** Where every session starts: in the grass south of the pond, facing it. */
export const GARDEN_SPAWN = { x: 10 * 16, y: 12 * 16 + 10, dir: 'n' } as const;

/**
 * Corner lattice: w water, s sand, d dirt, g grass. Paths leave east and west only; the hedge
 * gaps north and south open onto grass, so roads meet the garden at its east and west exits.
 */
const CORNERS = [
  'ggggggggggggggggggggg',
  'ggggggggggggggggggggg',
  'ggggggggggggggggggggg',
  'ggggggggggggggggggggg',
  'ggggggggggggggggggggg',
  'gggggggsssssssggggggg',
  'dddddddswwwwwsddddddd',
  'dddddddswwwwwsddddddd',
  'dddddddswwwwwsddddddd',
  'dddddddswwwwwsddddddd',
  'gggggggsssssssggggggg',
  'ggggggggggggggggggggg',
  'ggggggggggggggggggggg',
  'ggggggggggggggggggggg',
  'ggggggggggggggggggggg',
  'ggggggggggggggggggggg',
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
