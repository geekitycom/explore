import {
  MOVE_INTERVAL_MS,
  type Avatar,
  type BiomeCell,
  type Pose,
  type Screen,
} from '@explore/core';
import type { User } from '../api.ts';
import { keyboard } from './input.ts';
import { step } from './movement.ts';
import { connect } from './net.ts';
import { applyMessage, interpolate, type GameState } from './state.ts';

export type Renderer = {
  draw(state: GameState, you: User, clock: number): void;
  dispose(): void;
};

export type GameStatus = 'connecting' | 'open' | 'reconnecting' | 'replaced';

const samePose = (a: Pose, b: Pose) =>
  a.x === b.x && a.y === b.y && a.dir === b.dir && a.moving === b.moving;

/** Runs one player's session: input, prediction, networking, and the frame loop. */
export function startGame(
  initialUser: User,
  renderer: Renderer,
  onStatus: (s: GameStatus) => void,
  onScreen: (screen: Screen, patch: BiomeCell) => void = () => {},
) {
  let user = initialUser;
  let state: GameState = { phase: 'connecting' };
  let lastSent: Pose | undefined;
  let lastSentAt = 0;

  const keys = keyboard();
  Object.assign(window, { exploreState: () => state, exploreUser: () => user });
  const conn = connect({
    onMessage: (message) => {
      state = applyMessage(state, message);
      if (message.t === 'screen' || message.t === 'correct') lastSent = undefined;
      if (message.t === 'screen' && state.phase !== 'connecting')
        onScreen(state.screen, state.patch);
    },
    onStatus,
  });

  let previous = performance.now();
  let frameId = requestAnimationFrame(function frame(now) {
    const dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;

    if (state.phase === 'playing') {
      const { pose, exit } = step(state.screen, state.you, keys.held, dt, keys.lastPressed());
      state = { ...state, you: pose, others: interpolate(state.others, dt) };
      if (exit) {
        conn.send({ t: 'move', ...pose });
        conn.send({ t: 'travel', dir: exit });
        state = { ...state, phase: 'travelling', you: { ...pose, moving: false } };
      } else if (
        (!lastSent || !samePose(lastSent, pose)) &&
        (now - lastSentAt >= MOVE_INTERVAL_MS || !pose.moving)
      ) {
        conn.send({ t: 'move', ...pose });
        lastSent = pose;
        lastSentAt = now;
      }
    } else if (state.phase === 'travelling') {
      state = { ...state, others: interpolate(state.others, dt) };
    }

    renderer.draw(state, user, now);
    frameId = requestAnimationFrame(frame);
  });

  return {
    setAvatar: (avatar: Avatar) => {
      user = { ...user, avatar };
    },
    stop: () => {
      cancelAnimationFrame(frameId);
      keys.dispose();
      conn.close();
      renderer.dispose();
    },
  };
}
