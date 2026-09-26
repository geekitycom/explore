import {
  MOVE_INTERVAL_MS,
  type Avatar,
  type BiomeCell,
  type Place,
  type Pose,
  type Tile,
} from '@explore/core';
import type { User } from '../api.ts';
import { createHands, type Aim, type Hud } from './hands.ts';
import { keyboard } from './input.ts';
import { step } from './movement.ts';
import { connect } from './net.ts';
import { applyMessage, interpolate, type GameState } from './state.ts';

export type Renderer = {
  draw(state: GameState, you: User, clock: number, aim: Aim | undefined): void;
  /** The tile under a pointer event on the canvas. */
  tileAt(event: MouseEvent): Tile | undefined;
  dispose(): void;
};

export type GameStatus = 'connecting' | 'open' | 'reconnecting' | 'replaced';

const samePose = (a: Pose, b: Pose) =>
  a.x === b.x && a.y === b.y && a.dir === b.dir && a.moving === b.moving;

/** Runs one player's session: input, prediction, networking, and the frame loop. */
export function startGame(
  initialUser: User,
  renderer: Renderer,
  canvas: HTMLCanvasElement,
  hud: Hud,
  onStatus: (s: GameStatus) => void,
  onScreen: (place: Place, patch: BiomeCell) => void,
) {
  let user = initialUser;
  let state: GameState = { phase: 'connecting' };
  let lastSent: Pose | undefined;
  let lastSentAt = 0;

  const hands = createHands({
    hud,
    canvas,
    tileAt: (event) => renderer.tileAt(event),
    send: (message) => conn.send(message),
  });
  const keys = keyboard(hands.key);
  Object.assign(window, { exploreState: () => state, exploreUser: () => user });
  const conn = connect({
    onMessage: (message) => {
      state = applyMessage(state, message);
      if (message.t === 'refused') hands.refused(message.reason, performance.now());
      if (message.t === 'screen' || message.t === 'correct') lastSent = undefined;
      if (message.t === 'screen' && state.phase !== 'connecting')
        onScreen(state.place, state.patch);
    },
    onStatus,
  });

  let previous = performance.now();
  let frameId = requestAnimationFrame(function frame(now) {
    const dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;

    if (state.phase === 'playing') {
      const { pose, exit } = step(state.place, state.you, keys.held, dt, keys.lastPressed());
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

    const { aim } = hands.frame(state, user, now);
    renderer.draw(state, user, now, aim);
    frameId = requestAnimationFrame(frame);
  });

  return {
    setAvatar: (avatar: Avatar) => {
      user = { ...user, avatar };
    },
    pauseKeys: keys.pause,
    stop: () => {
      cancelAnimationFrame(frameId);
      keys.dispose();
      hands.dispose();
      conn.close();
      renderer.dispose();
    },
  };
}
