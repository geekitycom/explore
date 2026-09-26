import { tilePlant } from './flora.ts';
import { traceKey, type Ground, type TraceKey } from './traces/kind.ts';
import { TRACE_KIND_NAMES, kindNamed, type Trace, type TraceKindName } from './traces/registry.ts';
import {
  BLOCKING_FEATURES,
  SCREEN_H,
  SCREEN_W,
  featureAt,
  tileCorners,
  tileIndex,
  type Screen,
} from './world.ts';

export { traceAt, traceKey, type TraceKey } from './traces/kind.ts';

export type Tile = { readonly tx: number; readonly ty: number };

export type TileState = {
  readonly walkable: boolean;
  /** Some trace's look hides the generated feature, so it neither draws nor blocks. */
  readonly hidden: boolean;
  /** In registry order. */
  readonly traces: readonly Trace[];
};

/**
 * A screen as players find it: generator output (never changed, D23) plus every trace on it.
 * Immutable; a change makes a new Place, so identity is a cache key.
 */
export type Place = {
  readonly screen: Screen;
  readonly traces: ReadonlyMap<TraceKey, Trace>;
  /** Derived from `traces` by placeOf, row-major. */
  readonly tiles: readonly TileState[];
};

export type TraceAddress = Tile & { readonly kind: TraceKindName };
export type TraceChange = { readonly put: Trace } | { readonly drop: TraceAddress };

export function placeOf(screen: Screen, traces: readonly Trace[]): Place {
  return build(screen, new Map(traces.map((t) => [traceKey(t, t.kind), t])));
}

export function bare(screen: Screen): Place {
  return placeOf(screen, []);
}

export function withChanges(place: Place, changes: readonly TraceChange[]): Place {
  const traces = new Map(place.traces);
  for (const change of changes) {
    if ('put' in change) traces.set(traceKey(change.put, change.put.kind), change.put);
    else traces.delete(traceKey(change.drop, change.drop.kind));
  }
  return build(place.screen, traces);
}

export function allTraces(place: Place): Trace[] {
  return [...place.traces.values()];
}

export function tracesOn(place: Place, { tx, ty }: Tile): readonly Trace[] {
  return place.tiles[tileIndex(tx, ty)]?.traces ?? [];
}

const kindOrder = (t: Trace) => TRACE_KIND_NAMES.indexOf(t.kind);

function build(screen: Screen, traces: ReadonlyMap<TraceKey, Trace>): Place {
  const onTile: Trace[][] = Array.from({ length: SCREEN_W * SCREEN_H }, () => []);
  for (const t of traces.values()) onTile[tileIndex(t.tx, t.ty)]!.push(t);
  const tiles = onTile.map((here, i) =>
    tileState(
      screen,
      i % SCREEN_W,
      Math.floor(i / SCREEN_W),
      here.sort((a, b) => kindOrder(a) - kindOrder(b)),
    ),
  );
  return { screen, traces, tiles };
}

function tileState(screen: Screen, tx: number, ty: number, traces: readonly Trace[]): TileState {
  const feature = featureAt(screen, tx, ty);
  const hidden =
    traces.length > 0 && hides(traces, { feature, plant: tilePlant(screen, tx, ty)?.species });
  const flooded = tileCorners(screen, tx, ty).filter((c) => c === 'water').length >= 3;
  const walkable =
    !flooded &&
    !(BLOCKING_FEATURES.has(feature) && !hidden) &&
    !traces.some((t) => kindNamed(t.kind).solid(t));
  return { walkable, hidden, traces };
}

/** `hidesFeature` is time-independent by contract, so any `now` gives the same answer. */
const hides = (traces: readonly Trace[], ground: Ground) =>
  traces.some((t) => kindNamed(t.kind).look(t, ground, 0).hidesFeature);
