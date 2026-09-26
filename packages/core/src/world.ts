export const TILE = 16;
export const SCREEN_W = 20;
export const SCREEN_H = 15;
export const LATTICE_W = SCREEN_W + 1;
export const LATTICE_H = SCREEN_H + 1;
export const SCREEN_PX_W = SCREEN_W * TILE;
export const SCREEN_PX_H = SCREEN_H * TILE;

/** Draw order, bottom first. Transitions draw each higher terrain over the lower ones. */
export const TERRAINS = ['water', 'sand', 'dirt', 'path', 'grass', 'darkgrass', 'snow'] as const;
export type Terrain = (typeof TERRAINS)[number];

/** Fences join neighbouring tiles of the same fence into runs, corners, and rings. */
export const FENCES = ['picket', 'splitrail', 'railing', 'drystone'] as const;
export type Fence = (typeof FENCES)[number];

/** A fence tile: the fence whole, or fallen into disrepair. */
export type FenceFeature = Fence | `${Fence}-broken`;

export const FEATURES = [
  'none',
  'tree',
  'bush',
  'rock',
  'flowers',
  'tallgrass',
  'bigtree',
  ...FENCES,
  ...FENCES.map((f) => `${f}-broken` as const),
  'bones',
  'grave',
] as const;
export type Feature = (typeof FEATURES)[number];

export const BLOCKING_FEATURES: ReadonlySet<Feature> = new Set<Feature>([
  'tree',
  'bush',
  'rock',
  'bigtree',
  ...FENCES,
  ...FENCES.map((f) => `${f}-broken` as const),
  'grave',
]);

export const BIOMES = [
  'garden',
  'meadow',
  'forest',
  'lakeland',
  'scrubland',
  'desert',
  'highlands',
  'taiga',
  'tundra',
] as const;
export type Biome = (typeof BIOMES)[number];

/** A separate space of screens: the overworld now, interiors such as houses and caves later. */
export type LayerId = string & { readonly __brand: 'LayerId' };

export const OVERWORLD = 'overworld' as LayerId;

export type ScreenCoord = { readonly layer: LayerId; readonly sx: number; readonly sy: number };

export type WorldSeed = number & { readonly __brand: 'WorldSeed' };

export type World = { readonly seed: WorldSeed };

/**
 * Terrain lives on the corner lattice (LATTICE_W x LATTICE_H, row-major) so neighbors share
 * their boundary points exactly. Features live on tiles (SCREEN_W x SCREEN_H, row-major).
 */
export type Screen = {
  readonly coord: ScreenCoord;
  /** The biome at the screen's centre. */
  readonly biome: Biome;
  readonly corners: readonly Terrain[];
  readonly features: readonly Feature[];
};

export const DIRS = ['n', 'e', 's', 'w'] as const;
export type Dir = (typeof DIRS)[number];

export const DIR_DELTA: Record<Dir, { readonly dx: number; readonly dy: number }> = {
  n: { dx: 0, dy: -1 },
  e: { dx: 1, dy: 0 },
  s: { dx: 0, dy: 1 },
  w: { dx: -1, dy: 0 },
};

/** A player's feet, in screen pixels, and which way they face. */
export type Pose = { x: number; y: number; dir: Dir; moving: boolean };

export const OPPOSITE: Record<Dir, Dir> = { n: 's', e: 'w', s: 'n', w: 'e' };

export function screenKey({ layer, sx, sy }: ScreenCoord): string {
  return `${layer}/${sx},${sy}`;
}

/** Screens are generated and stored a chunk at a time, CHUNK_W by CHUNK_H screens. */
export const CHUNK_W = 4;
export const CHUNK_H = 4;

export type ChunkCoord = { readonly layer: LayerId; readonly cx: number; readonly cy: number };

export function chunkKey({ layer, cx, cy }: ChunkCoord): string {
  return `${layer}/${cx},${cy}`;
}

export function chunkOf({ layer, sx, sy }: ScreenCoord): ChunkCoord {
  return { layer, cx: Math.floor(sx / CHUNK_W), cy: Math.floor(sy / CHUNK_H) };
}

/** The chunk's screens, row-major from its north-west corner. */
export function chunkScreens({ layer, cx, cy }: ChunkCoord): ScreenCoord[] {
  const screens: ScreenCoord[] = [];
  for (let dy = 0; dy < CHUNK_H; dy++) {
    for (let dx = 0; dx < CHUNK_W; dx++) {
      screens.push({ layer, sx: cx * CHUNK_W + dx, sy: cy * CHUNK_H + dy });
    }
  }
  return screens;
}

export function neighborCoord({ layer, sx, sy }: ScreenCoord, dir: Dir): ScreenCoord {
  const { dx, dy } = DIR_DELTA[dir];
  return { layer, sx: sx + dx, sy: sy + dy };
}

export function cornerIndex(cx: number, cy: number): number {
  return cy * LATTICE_W + cx;
}

export function tileIndex(tx: number, ty: number): number {
  return ty * SCREEN_W + tx;
}

export function inScreen(tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < SCREEN_W && ty < SCREEN_H;
}

export function cornerAt(screen: Screen, cx: number, cy: number): Terrain {
  return screen.corners[cornerIndex(cx, cy)]!;
}

export function featureAt(screen: Screen, tx: number, ty: number): Feature {
  return screen.features[tileIndex(tx, ty)]!;
}

/** The tile's corners in NW, NE, SW, SE order. */
export function tileCorners(
  screen: Screen,
  tx: number,
  ty: number,
): [Terrain, Terrain, Terrain, Terrain] {
  return [
    cornerAt(screen, tx, ty),
    cornerAt(screen, tx + 1, ty),
    cornerAt(screen, tx, ty + 1),
    cornerAt(screen, tx + 1, ty + 1),
  ];
}
