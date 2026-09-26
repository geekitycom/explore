import { tilePlant } from '../flora.ts';
import { tracesOn, withChanges, type Place, type Tile, type TraceChange } from '../place.ts';
import { facedTile, inReach, isWalkable, overlapsBox, wayIfSolid } from '../walk.ts';
import { featureAt, inScreen, tileCorners } from '../world.ts';
import { gain, spend, stackAt, type Inventory, type Slot } from './inventory.ts';
import {
  refuse,
  traceKey,
  type AnyKind,
  type Bubble,
  type Here,
  type Plan,
  type Refusal,
  type Spot,
  type Verdict,
} from './kind.ts';
import { kindNamed, kindsInOrder, traceFrom, type Trace, type TraceKindName } from './registry.ts';

export type Act =
  | { readonly verb: 'interact'; readonly tile: Tile }
  | { readonly verb: 'use'; readonly slot: Slot; readonly tile: Tile }
  | { readonly verb: 'act'; readonly kind: TraceKindName; readonly input: unknown };

export type Outcome =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'refused'; readonly reason: string }
  | {
      readonly kind: 'done';
      readonly label: string;
      readonly changes: readonly TraceChange[];
      readonly inventory: Inventory;
    };

export const REASONS = {
  far: 'Too far away. Walk closer.',
  you: 'Too close. Step back.',
  someone: 'Someone is standing there.',
  edge: 'Leave the edge of the screen clear.',
  splits: 'That would block the way.',
  badInput: 'That does not fit.',
} as const;

type Chosen = {
  readonly ok: true;
  readonly kind: AnyKind;
  readonly tile: Tile;
  readonly plan: Plan<object>;
};

const claim = (kind: AnyKind, tile: Tile, verdict: Verdict<object>): Chosen | Refusal =>
  verdict.ok ? { ok: true, kind, tile, plan: verdict } : verdict;

const NOTHING: Outcome = { kind: 'nothing' };
const refused = (reason: string): Outcome => ({ kind: 'refused', reason });

/**
 * Pure; the server enforces it and the client predicts with it. 1) interact/use: the tile is
 * on the screen and in reach, else REASONS.far. 2) the owning kind's verdict. 3) the change:
 * put the kind's trace or drop it. 4) world rules only when the change turns a walkable tile
 * solid: own box, someone's box, edge, splits. 5) inventory: use spends one from the slot;
 * plan.gain goes through gain(), whose refusal wins.
 */
export function resolve(here: Here, act: Act): Outcome {
  if (
    act.verb !== 'act' &&
    !(inScreen(act.tile.tx, act.tile.ty) && inReach(here.me.pose, act.tile))
  )
    return refused(REASONS.far);
  const chosen = choose(here, act);
  if (chosen === undefined) return NOTHING;
  if (!chosen.ok) return refused(chosen.reason);
  const { kind, tile, plan } = chosen;

  const changes = changeOf(here.place, kind, tile, plan);
  const blocked = worldRule(here, tile, changes);
  if (blocked) return refused(blocked);

  let inventory = act.verb === 'use' ? spend(here.inventory, act.slot) : here.inventory;
  if (plan.gain) {
    const gained = gain(inventory, plan.gain);
    if (!gained.ok) return refused(gained.reason);
    inventory = gained.inventory;
  }
  return { kind: 'done', label: plan.label, changes, inventory };
}

function choose(here: Here, act: Act): Chosen | Refusal | undefined {
  switch (act.verb) {
    case 'interact':
      return interaction(here, act.tile);
    case 'use': {
      const stack = stackAt(here.inventory, act.slot);
      const kind = stack && kindNamed(stack.kind);
      if (!stack || !kind?.carry) return undefined;
      const spot = spotFor(here.place, kind, act.tile);
      return claim(kind, act.tile, kind.carry.use(here, spot, stack.variant));
    }
    case 'act': {
      const kind = kindNamed(act.kind);
      const input = kind.action?.input.safeParse(act.input);
      if (!kind.action || !input?.success) return refuse(REASONS.badInput);
      const verdict = kind.action.apply(here, input.data);
      return verdict.ok ? claim(kind, verdict.at, verdict) : verdict;
    }
  }
}

/** The first kind, in registry order, that claims the tile. */
function interaction(here: Here, tile: Tile): Chosen | Refusal | undefined {
  for (const kind of kindsInOrder()) {
    const verdict = kind.interact?.(here, spotFor(here.place, kind, tile));
    if (verdict) return claim(kind, tile, verdict);
  }
  return undefined;
}

function spotFor(place: Place, kind: AnyKind, tile: Tile): Spot<Trace> {
  const { tx, ty } = tile;
  return {
    tile,
    feature: featureAt(place.screen, tx, ty),
    plant: tilePlant(place.screen, tx, ty)?.species,
    corners: tileCorners(place.screen, tx, ty),
    walkable: isWalkable(place, tx, ty),
    mine: place.traces.get(traceKey(tile, kind.kind)),
    traces: tracesOn(place, tile),
  };
}

function changeOf(place: Place, kind: AnyKind, tile: Tile, plan: Plan<object>): TraceChange[] {
  if (plan.next) return [{ put: traceFrom(kind, tile, plan.next) }];
  const address = { tx: tile.tx, ty: tile.ty, kind: kind.kind };
  return place.traces.has(traceKey(tile, address.kind)) ? [{ drop: address }] : [];
}

function worldRule(here: Here, tile: Tile, changes: readonly TraceChange[]): string | undefined {
  const { place } = here;
  if (!isWalkable(place, tile.tx, tile.ty)) return undefined;
  if (isWalkable(withChanges(place, changes), tile.tx, tile.ty)) return undefined;
  if (overlapsBox(tile, here.me.pose)) return REASONS.you;
  if (here.others.some((pose) => overlapsBox(tile, pose))) return REASONS.someone;
  const way = wayIfSolid(place, tile);
  return way === 'open' ? undefined : REASONS[way];
}

export type Prompt =
  | { readonly kind: 'act'; readonly label: string }
  | { readonly kind: 'offer'; readonly label: string; readonly compose: TraceKindName };

/** The faced tile's interact label, else the first kind's offer. */
export function promptAt(here: Here): Prompt | undefined {
  const tile = facedTile(here.me.pose);
  const chosen = tile && interaction(here, tile);
  if (chosen?.ok) return { kind: 'act', label: chosen.plan.label };
  for (const kind of kindsInOrder()) {
    const label = kind.offer?.(here);
    if (label !== undefined) return { kind: 'offer', label, compose: kind.kind };
  }
  return undefined;
}

export type Said = { readonly tile: Tile; readonly kind: TraceKindName; readonly bubble: Bubble };

/**
 * The bubbles of traces on tiles in reach, one per tile: the first kind's in registry order, with
 * the words of any other kind on that tile as its second line. So a grave reads its epitaph and
 * then who left flowers on it.
 */
export function bubblesAt(here: Here): Said[] {
  const byTile = new Map<string, Said>();
  for (const kind of kindsInOrder()) {
    for (const trace of here.place.traces.values()) {
      if (trace.kind !== kind.kind || !inReach(here.me.pose, trace)) continue;
      const bubble = kind.bubble?.(trace, here.now);
      if (!bubble) continue;
      const key = `${trace.tx},${trace.ty}`;
      const first = byTile.get(key);
      if (!first) {
        byTile.set(key, { tile: { tx: trace.tx, ty: trace.ty }, kind: trace.kind, bubble });
        continue;
      }
      const line = [first.bubble.line, bubble.text].filter(Boolean).join(' · ');
      byTile.set(key, { ...first, bubble: { ...first.bubble, line } });
    }
  }
  return [...byTile.values()];
}
