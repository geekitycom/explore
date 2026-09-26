import { z } from 'zod';
import type { Tile } from '../place.ts';
import type { AnyKind, Limits, TraceOf } from './kind.ts';
import * as KINDS from './kinds/index.ts';

type KindTable = typeof KINDS;
type Union<M> = M[keyof M];

type TraceFor<T> = T extends {
  readonly kind: infer K extends string;
  readonly fields: infer S extends z.ZodRawShape;
}
  ? TraceOf<K, S>
  : never;

type ItemFor<T> = T extends {
  readonly kind: infer K extends string;
  readonly carry?: { readonly variant: z.ZodType<infer V> };
}
  ? [V] extends [never]
    ? never
    : { readonly kind: K; readonly variant: V }
  : never;

export type Trace = Union<{ [N in keyof KindTable]: TraceFor<KindTable[N]> }>;
type TraceInput = Union<{ [N in keyof KindTable]: z.input<KindTable[N]['schema']> }>;
export type TraceKindName = Trace['kind'];
export type TraceNamed<K extends TraceKindName> = Extract<Trace, { readonly kind: K }>;
export type Item = Union<{ [N in keyof KindTable]: ItemFor<KindTable[N]> }>;
export type ItemKindName = Item['kind'];

const KIND_LIST: readonly AnyKind[] = Object.values(KINDS);
const BY_NAME = new Map(KIND_LIST.map((k) => [k.kind, k]));

const nonEmpty = <T>(list: readonly T[]) => list as unknown as [T, ...T[]];

/** In registry order: alphabetical by export name, since a module namespace sorts its keys. */
export const TRACE_KIND_NAMES = nonEmpty(KIND_LIST.map((k) => k.kind));

/** Every trace on the wire and in a row. An unknown kind fails. */
export const traceSchema = z.discriminatedUnion(
  'kind',
  nonEmpty(KIND_LIST.map((k) => k.schema)),
) as unknown as z.ZodType<Trace, TraceInput>;

export const itemSchema = z.discriminatedUnion(
  'kind',
  nonEmpty(
    KIND_LIST.flatMap((k) =>
      k.carry ? [z.object({ kind: z.literal(k.kind), variant: k.carry.variant })] : [],
    ),
  ),
) as unknown as z.ZodType<Item, Item>;

export const actionSchema = z.discriminatedUnion(
  'kind',
  nonEmpty(
    KIND_LIST.flatMap((k) =>
      k.action ? [z.object({ kind: z.literal(k.kind), input: k.action.input })] : [],
    ),
  ),
) as unknown as z.ZodType<{ kind: TraceKindName; input: unknown }>;

/** The one table of per-kind limits. */
export const LIMITS = Object.fromEntries(
  KIND_LIST.map((k) => [k.kind, k.limits ?? {}]),
) as Readonly<Record<TraceKindName, Limits>>;

export function kindNamed(name: TraceKindName): AnyKind {
  return BY_NAME.get(name)!;
}

export function kindsInOrder(): readonly AnyKind[] {
  return KIND_LIST;
}

/** A kind's trace on a tile from the fields its plan chose; the kind's types checked them. */
export function traceFrom(kind: AnyKind, { tx, ty }: Tile, fields: object): Trace {
  return { ...fields, kind: kind.kind, tx, ty } as Trace;
}

/** Drops what no longer parses, so a stale client or an old row survives a deploy. */
export function parseTraces(raw: readonly unknown[]): Trace[] {
  return raw.flatMap((r) => {
    const parsed = traceSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
}
