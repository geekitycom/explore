import { z } from 'zod';
import type { Species } from '../flora.ts';
import type { Place, Tile, TraceChange } from '../place.ts';
import type { Recipe } from '../recipes/index.ts';
import type { Feature, Pose, Terrain, World } from '../world.ts';
import { tileX, tileY } from './fields.ts';
import type { Inventory } from './inventory.ts';
import type { Item, Trace, TraceKindName, TraceNamed } from './registry.ts';

export type TraceBase<K extends string> = {
  readonly kind: K;
  readonly tx: number;
  readonly ty: number;
};
export type TraceOf<K extends string, S extends z.ZodRawShape> = TraceBase<K> &
  Readonly<z.output<z.ZodObject<S>>>;
export type Fields<T> = Omit<T, 'kind' | 'tx' | 'ty'>;

export type Here = {
  readonly place: Place;
  readonly me: { readonly id: number; readonly name: string; readonly pose: Pose };
  /** Everyone else on the screen. */
  readonly others: readonly Pose[];
  readonly inventory: Inventory;
  /** Milliseconds since the epoch. */
  readonly now: number;
};

export type Spot<T> = {
  readonly tile: Tile;
  /** As generated, even when a trace hides it. */
  readonly feature: Feature;
  readonly plant: Species | undefined;
  readonly corners: readonly [Terrain, Terrain, Terrain, Terrain];
  /** With every trace applied. */
  readonly walkable: boolean;
  /** This kind's trace on the tile. */
  readonly mine: T | undefined;
  readonly traces: readonly Trace[];
};

/** `${tx},${ty},${kind}` */
export type TraceKey = string & { readonly __brand: 'TraceKey' };

export const traceKey = ({ tx, ty }: Tile, kind: TraceKindName): TraceKey =>
  `${tx},${ty},${kind}` as TraceKey;

/**
 * Lives here rather than in place.ts so a kind can look up traces without importing the
 * registry, which imports every kind.
 */
export function traceAt<K extends TraceKindName>(
  place: Place,
  tile: Tile,
  kind: K,
): TraceNamed<K> | undefined {
  const trace = place.traces.get(traceKey(tile, kind));
  return trace && isNamed(trace, kind) ? trace : undefined;
}

const isNamed = <K extends TraceKindName>(trace: Trace, kind: K): trace is TraceNamed<K> =>
  trace.kind === kind;

export type Ground = { readonly feature: Feature; readonly plant: Species | undefined };

export type Refusal = { readonly ok: false; readonly reason: string };
export type Plan<T> = {
  readonly ok: true;
  readonly label: string;
  /** The kind's trace on the tile afterwards, or null to remove it. */
  readonly next: Fields<T> | null;
  readonly gain?: Item;
};
export type Verdict<T> = Plan<T> | Refusal;

export const refuse = (reason: string): Refusal => ({ ok: false, reason });

export type Look = {
  /** Time-independent, like `solid`: walkability reads it. */
  readonly hidesFeature: boolean;
  readonly recipe: Recipe | undefined;
};

export type Limits = { readonly carry?: number } & Readonly<Record<string, number>>;

export type Carry<V, T> = {
  readonly variant: z.ZodType<V>;
  /** The refusal at the carry limit. */
  readonly full: string;
  name(variant: V): string;
  icon(variant: V): Recipe;
  use(here: Here, spot: Spot<T>, variant: V): Verdict<T>;
};

export type Action<I, T> = {
  readonly input: z.ZodType<I>;
  /** The kind chooses the tile. */
  apply(here: Here, input: I): Refusal | (Plan<T> & { readonly at: Tile });
};

export type TraceKindSpec<K extends string, S extends z.ZodRawShape, V, I> = {
  readonly kind: K;
  readonly fields: S;
  readonly limits?: Limits;
  solid(trace: TraceOf<K, S>): boolean;
  look(trace: TraceOf<K, S>, ground: Ground, now: number): Look;
  bubble?(trace: TraceOf<K, S>, now: number): string | undefined;
  /** E or Space on the faced tile; undefined means the tile is not this kind's business. */
  interact?(here: Here, spot: Spot<TraceOf<K, S>>): Verdict<TraceOf<K, S>> | undefined;
  /** A screen-wide idle prompt not tied to the faced tile. */
  offer?(here: Here): string | undefined;
  /** Server-made traces the kind wants on a screen when its room opens. Idempotent. */
  settle?(place: Place, world: World): readonly TraceChange[];
  readonly carry?: Carry<V, TraceOf<K, S>>;
  readonly action?: Action<I, TraceOf<K, S>>;
};

type TraceShape<K extends string, S extends z.ZodRawShape> = {
  kind: z.ZodLiteral<K>;
  tx: typeof tileX;
  ty: typeof tileY;
} & S;

export type TraceKind<K extends string, S extends z.ZodRawShape, V, I> = TraceKindSpec<
  K,
  S,
  V,
  I
> & { readonly schema: z.ZodObject<TraceShape<K, S>> };

/** A kind with its types erased, as the engine iterates them. */
export type AnyKind = TraceKind<TraceKindName, z.ZodRawShape, unknown, unknown>;

export function traceKind<
  const K extends string,
  const S extends z.ZodRawShape,
  V = never,
  I = never,
>(spec: TraceKindSpec<K, S, V, I>): TraceKind<K, S, V, I> {
  const shape: TraceShape<K, S> = {
    ...spec.fields,
    kind: z.literal(spec.kind),
    tx: tileX,
    ty: tileY,
  };
  return { ...spec, schema: z.object(shape) };
}
