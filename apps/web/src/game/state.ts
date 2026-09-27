import {
  TRACE_KIND_NAMES,
  decodeScreen,
  parseInventory,
  parseTraces,
  placeOf,
  traceSchema,
  withChanges,
  type BiomeCell,
  type Inventory,
  type Place,
  type PlayerView,
  type Pose,
  type ServerMessage,
  type TraceChange,
  type TraceChangeRecord,
} from '@explore/core';
import type { Portal } from './portal.ts';

/** Another player as drawn: their last reported pose plus where we are currently drawing them. */
type Remote = PlayerView & { drawX: number; drawY: number };

/**
 * `waking` shows the world held still until the player starts the session. `portals` are the
 * visitors coming and going on this screen, you among them; the frame loop drops each once closed.
 */
export type GameState =
  | { phase: 'connecting' }
  | {
      phase: 'waking' | 'playing' | 'travelling';
      place: Place;
      inventory: Inventory;
      patch: BiomeCell;
      you: Pose;
      others: ReadonlyMap<number, Remote>;
      portals: readonly Portal[];
      /** Whether the server can suggest landmark names, as its last `screen` said. */
      suggestions: boolean;
    };

const remote = (player: PlayerView): Remote => ({ ...player, drawX: player.x, drawY: player.y });

/** `now` is the render clock, when any portal the message opens begins. */
export function applyMessage(state: GameState, message: ServerMessage, now: number): GameState {
  if (message.t === 'screen') {
    const { arrival } = message;
    return {
      phase: arrival.kind === 'wake' || state.phase === 'waking' ? 'waking' : 'playing',
      place: placeOf(decodeScreen(message.screen), parseTraces(message.traces)),
      inventory: parseInventory(message.inventory),
      patch: message.patch,
      you: message.you,
      others: new Map(message.others.map((p) => [p.id, remote(p)])),
      portals:
        arrival.kind === 'visit'
          ? [{ kind: 'arrive', tile: arrival.portal, start: now, traveller: 'you' }]
          : [],
      suggestions: message.suggestions,
    };
  }
  if (state.phase === 'connecting') return state;

  switch (message.t) {
    case 'join':
      return {
        ...state,
        others: new Map(state.others).set(message.player.id, remote(message.player)),
        portals: message.portal
          ? [
              ...state.portals,
              { kind: 'arrive', tile: message.portal, start: now, traveller: message.player },
            ]
          : state.portals,
      };
    case 'leave': {
      const gone = state.others.get(message.id);
      const others = new Map(state.others);
      others.delete(message.id);
      if (!message.portal || !gone) return { ...state, others };
      const { drawX, drawY, ...view } = gone;
      const traveller = { ...view, x: drawX, y: drawY, moving: false };
      return {
        ...state,
        others,
        portals: [
          ...state.portals,
          { kind: 'depart', tile: message.portal, start: now, traveller },
        ],
      };
    }
    case 'depart':
      return {
        ...state,
        portals: [
          ...state.portals,
          { kind: 'depart', tile: message.portal, start: now, traveller: 'you' },
        ],
      };
    case 'moved': {
      const current = state.others.get(message.id);
      if (!current) return state;
      const { x, y, dir, moving } = message;
      return {
        ...state,
        others: new Map(state.others).set(message.id, { ...current, x, y, dir, moving }),
      };
    }
    case 'profile': {
      const current = state.others.get(message.id);
      if (!current) return state;
      const { name, avatar } = message;
      return {
        ...state,
        others: new Map(state.others).set(message.id, { ...current, name, avatar }),
      };
    }
    case 'correct':
      return {
        ...state,
        phase: 'playing',
        you: { ...state.you, x: message.x, y: message.y, moving: false },
      };
    case 'traces':
      return { ...state, place: withChanges(state.place, message.changes.flatMap(parseChange)) };
    case 'inventory':
      return { ...state, inventory: parseInventory(message.stacks) };
    case 'refused':
    case 'suggestion':
      return state;
  }
}

/** Drops a change whose kind this client does not know, so a stale tab survives a deploy. */
function parseChange(change: TraceChangeRecord): TraceChange[] {
  if ('put' in change) {
    const parsed = traceSchema.safeParse(change.put);
    return parsed.success ? [{ put: parsed.data }] : [];
  }
  const { tx, ty } = change.drop;
  const kind = TRACE_KIND_NAMES.find((k) => k === change.drop.kind);
  return kind ? [{ drop: { tx, ty, kind } }] : [];
}

/** Eases each remote player's drawn position toward their reported one. */
export function interpolate(
  others: ReadonlyMap<number, Remote>,
  dtSeconds: number,
): Map<number, Remote> {
  const t = 1 - Math.exp(-dtSeconds * 12);
  return new Map(
    [...others].map(([id, p]) => {
      const far = Math.hypot(p.x - p.drawX, p.y - p.drawY) > 48;
      return [
        id,
        far
          ? { ...p, drawX: p.x, drawY: p.y }
          : { ...p, drawX: p.drawX + (p.x - p.drawX) * t, drawY: p.drawY + (p.y - p.drawY) * t },
      ];
    }),
  );
}
