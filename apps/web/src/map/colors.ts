import {
  SCREEN_H,
  SCREEN_W,
  TERRAINS,
  featureAt,
  tileCorners,
  type Feature,
  type Screen,
  type Terrain,
} from '@explore/core';

type Rgb = readonly [number, number, number];

export const TERRAIN_COLOR: Record<Terrain, Rgb> = {
  water: [95, 180, 217],
  sand: [232, 201, 143],
  dirt: [176, 122, 82],
  path: [105, 89, 83],
  grass: [143, 174, 58],
  darkgrass: [106, 150, 50],
  snow: [240, 238, 244],
};

export const FEATURE_COLOR: Record<Feature, Rgb | undefined> = {
  none: undefined,
  tree: [52, 90, 82],
  bush: [86, 134, 76],
  rock: [138, 138, 128],
  flowers: [217, 133, 159],
  tallgrass: [164, 194, 74],
  bigtree: [36, 70, 60],
  picket: [242, 234, 241],
  'picket-broken': [242, 234, 241],
  splitrail: [150, 83, 64],
  'splitrail-broken': [150, 83, 64],
  railing: [59, 54, 67],
  'railing-broken': [59, 54, 67],
  drystone: [141, 151, 127],
  'drystone-broken': [141, 151, 127],
  bones: [238, 207, 155],
  grave: [141, 151, 127],
};

/** The terrain most of a tile's corners share, with ties going to the one drawn on top. */
function tileTerrain(corners: readonly Terrain[]): Terrain {
  let best = corners[0]!;
  let bestCount = 0;
  for (const t of TERRAINS) {
    const count = corners.filter((c) => c === t).length;
    if (count >= bestCount && count > 0) [best, bestCount] = [t, count];
  }
  return best;
}

/** One pixel per tile, SCREEN_W x SCREEN_H RGBA, with features blended over their ground. */
export function screenPixels(screen: Screen): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(SCREEN_W * SCREEN_H * 4);
  for (let ty = 0; ty < SCREEN_H; ty++) {
    for (let tx = 0; tx < SCREEN_W; tx++) {
      const ground = TERRAIN_COLOR[tileTerrain(tileCorners(screen, tx, ty))];
      const mark = FEATURE_COLOR[featureAt(screen, tx, ty)];
      const color = mark ? ground.map((g, i) => Math.round(g * 0.3 + mark[i]! * 0.7)) : ground;
      out.set([color[0], color[1], color[2], 255], (ty * SCREEN_W + tx) * 4);
    }
  }
  return out;
}
