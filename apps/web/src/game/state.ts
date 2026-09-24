import {
  decodeScreen,
  type PlayerView,
  type Pose,
  type Screen,
  type ServerMessage,
} from '@explore/core';

/** Another player as drawn: their last reported pose plus where we are currently drawing them. */
export type Remote = PlayerView & { drawX: number; drawY: number };

export type GameState =
  | { phase: 'connecting' }
  | {
      phase: 'playing' | 'travelling';
      screen: Screen;
      you: Pose;
      others: ReadonlyMap<number, Remote>;
    };

const remote = (player: PlayerView): Remote => ({ ...player, drawX: player.x, drawY: player.y });

export function applyMessage(state: GameState, message: ServerMessage): GameState {
  if (message.t === 'screen') {
    return {
      phase: 'playing',
      screen: decodeScreen(message.screen),
      you: message.you,
      others: new Map(message.others.map((p) => [p.id, remote(p)])),
    };
  }
  if (state.phase === 'connecting') return state;

  switch (message.t) {
    case 'join':
      return {
        ...state,
        others: new Map(state.others).set(message.player.id, remote(message.player)),
      };
    case 'leave': {
      const others = new Map(state.others);
      others.delete(message.id);
      return { ...state, others };
    }
    case 'moved': {
      const current = state.others.get(message.id);
      if (!current) return state;
      const { x, y, dir, moving } = message;
      return {
        ...state,
        others: new Map(state.others).set(message.id, { ...current, x, y, dir, moving }),
      };
    }
    case 'correct':
      return { ...state, you: { ...state.you, x: message.x, y: message.y, moving: false } };
  }
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
