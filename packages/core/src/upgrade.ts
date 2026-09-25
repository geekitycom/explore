import { z } from 'zod';
import {
  SCREEN_RECORD_VERSION,
  decodeScreen,
  encodeScreen,
  layerIdSchema,
  type ScreenRecord,
} from './codec.ts';
import { biomeOf } from './generate.ts';
import { OVERWORLD, type World } from './world.ts';

type Loose = Record<string, unknown>;
type Upgrade = (record: Loose, world: World) => Loose;

/** A tuple with one entry per record version below N. */
type Chain<N extends number, R extends Upgrade[] = []> = [...R, Upgrade]['length'] extends N
  ? R
  : Chain<N, [...R, Upgrade]>;

const coordSchema = z.object({ layer: layerIdSchema, sx: z.number().int(), sy: z.number().int() });

const versionSchema = z.looseObject({ v: z.number().int().min(1).max(SCREEN_RECORD_VERSION) });

/**
 * One step per past record version, lifting a record to the next version. The tuple's length is
 * tied to SCREEN_RECORD_VERSION, so bumping the version without adding a step fails to compile.
 * A step adds what the new version needs; fields the current schema no longer knows are dropped
 * when the result is decoded.
 */
const UPGRADES: Chain<typeof SCREEN_RECORD_VERSION> = [
  (r) => ({ ...r, v: 2, layer: OVERWORLD }),
  (r) => ({ ...r, v: 3 }),
  (r, world) => ({ ...r, v: 4, biome: biomeOf(world, coordSchema.parse(r)) }),
];

/** Lifts a stored record of any past version to the current one, keeping its cells as they are. */
export function upgradeScreenRecord(raw: unknown, world: World): ScreenRecord {
  const versioned = versionSchema.parse(raw);
  const upgraded = UPGRADES.slice(versioned.v - 1).reduce<Loose>(
    (record, step) => step(record, world),
    versioned,
  );
  return encodeScreen(decodeScreen(upgraded));
}
