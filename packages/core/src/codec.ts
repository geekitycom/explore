import { z } from 'zod';
import {
  BIOMES,
  FEATURES,
  LATTICE_H,
  LATTICE_W,
  SCREEN_H,
  SCREEN_W,
  TERRAINS,
  type Feature,
  type LayerId,
  type Screen,
  type Terrain,
  type WorldSeed,
} from './world.ts';

const TERRAIN_CODE: Record<Terrain, string> = {
  water: 'w',
  sand: 's',
  dirt: 'd',
  path: 'p',
  grass: 'g',
  darkgrass: 'k',
  snow: 'n',
};
const FEATURE_CODE: Record<Feature, string> = {
  none: '.',
  tree: 'T',
  bush: 'B',
  rock: 'R',
  flowers: 'f',
  tallgrass: 't',
  bigtree: 'O',
  picket: 'P',
  'picket-broken': 'p',
  splitrail: 'S',
  'splitrail-broken': 's',
  railing: 'I',
  'railing-broken': 'i',
  drystone: 'W',
  'drystone-broken': 'w',
};

const invert = <K extends string>(codes: Record<K, string>, keys: readonly K[]) =>
  new Map(keys.map((k) => [codes[k], k]));

const TERRAIN_BY_CODE = invert(TERRAIN_CODE, TERRAINS);
const FEATURE_BY_CODE = invert(FEATURE_CODE, FEATURES);

const codeString = <K>(length: number, byCode: Map<string, K>) =>
  z
    .string()
    .length(length)
    .refine((s) => [...s].every((ch) => byCode.has(ch)), 'unknown cell code')
    .transform((s) => [...s].map((ch) => byCode.get(ch)!));

export const layerIdSchema = z
  .string()
  .min(1)
  .transform((s) => s as LayerId);

export const worldSeedSchema = z
  .number()
  .int()
  .transform((n) => n as WorldSeed);

/** Bumped whenever stored screens can no longer be read. Generator changes bump GENERATOR_VERSION. */
export const SCREEN_RECORD_VERSION = 4;

/** The persisted, versioned form of a screen. One character per lattice point or tile. */
const screenRecordSchema = z.object({
  v: z.literal(SCREEN_RECORD_VERSION),
  layer: layerIdSchema,
  sx: z.number().int(),
  sy: z.number().int(),
  biome: z.enum(BIOMES),
  corners: codeString(LATTICE_W * LATTICE_H, TERRAIN_BY_CODE),
  features: codeString(SCREEN_W * SCREEN_H, FEATURE_BY_CODE),
});

export type ScreenRecord = z.input<typeof screenRecordSchema>;

export function encodeScreen(screen: Screen): ScreenRecord {
  return {
    v: SCREEN_RECORD_VERSION,
    layer: screen.coord.layer,
    sx: screen.coord.sx,
    sy: screen.coord.sy,
    biome: screen.biome,
    corners: screen.corners.map((t) => TERRAIN_CODE[t]).join(''),
    features: screen.features.map((f) => FEATURE_CODE[f]).join(''),
  };
}

export function decodeScreen(raw: unknown): Screen {
  const r = screenRecordSchema.parse(raw);
  return {
    coord: { layer: r.layer, sx: r.sx, sy: r.sy },
    biome: r.biome,
    corners: r.corners,
    features: r.features,
  };
}
