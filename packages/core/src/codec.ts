import { z } from 'zod';
import {
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
} from './world.ts';

const TERRAIN_CODE: Record<Terrain, string> = { water: 'w', sand: 's', dirt: 'd', grass: 'g' };
const FEATURE_CODE: Record<Feature, string> = {
  none: '.',
  tree: 'T',
  bush: 'B',
  rock: 'R',
  flowers: 'f',
  tallgrass: 't',
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

/** The persisted, versioned form of a screen. One character per lattice point or tile. */
export const screenRecordSchema = z.object({
  v: z.literal(2),
  layer: layerIdSchema,
  sx: z.number().int(),
  sy: z.number().int(),
  seed: z.number().int(),
  corners: codeString(LATTICE_W * LATTICE_H, TERRAIN_BY_CODE),
  features: codeString(SCREEN_W * SCREEN_H, FEATURE_BY_CODE),
});

export type ScreenRecord = z.input<typeof screenRecordSchema>;

export function encodeScreen(screen: Screen): ScreenRecord {
  return {
    v: 2,
    layer: screen.coord.layer,
    sx: screen.coord.sx,
    sy: screen.coord.sy,
    seed: screen.seed,
    corners: screen.corners.map((t) => TERRAIN_CODE[t]).join(''),
    features: screen.features.map((f) => FEATURE_CODE[f]).join(''),
  };
}

export function decodeScreen(raw: unknown): Screen {
  const r = screenRecordSchema.parse(raw);
  return {
    coord: { layer: r.layer, sx: r.sx, sy: r.sy },
    seed: r.seed,
    corners: r.corners,
    features: r.features,
  };
}

export function terrainFromCode(ch: string): Terrain | undefined {
  return TERRAIN_BY_CODE.get(ch);
}

export function featureFromCode(ch: string): Feature | undefined {
  return FEATURE_BY_CODE.get(ch);
}
