import {
  MOVE_INTERVAL_MS,
  type Arrival,
  type BiomeCell,
  type Place,
  type Pose,
} from '@explore/core';
import type { User } from '../api.ts';
import { createHands, type Aim, type Hud, type Point } from './hands.ts';
import { keyboard } from './input.ts';
import { steer, step } from './movement.ts';
import { connect, type ConnectionStatus } from './net.ts';
import { applyMessage, interpolate, type GameState } from './state.ts';

export type Renderer = {
  draw(state: GameState, you: User, clock: number, aim: Aim | undefined): void;
  /** A pointer event's position in game pixels, unclamped to the screen. */
  pointAt(event: MouseEvent): Point;
  dispose(): void;
};

export type GameStatus = 'connecting' | ConnectionStatus;

export type GameHooks = {
  onStatus: (s: GameStatus) => void;
  onScreen: (place: Place, patch: BiomeCell) => void;
  /**
   * The first screen of a connection, and any later screen that is a fresh arrival. TASK-67's
   * arrival portal attaches here.
   */
  onArrive: (arrival: Arrival) => void;
  /** The host closed their world; the caller takes the player home. TASK-67's departure portal attaches here. */
  onSentHome: (reason: string) => void;
};

const samePose = (a: Pose, b: Pose) =>
  a.x === b.x && a.y === b.y && a.dir === b.dir && a.moving === b.moving;

/** Runs one player's session in `worldId`: input, prediction, networking, and the frame loop. */
export function startGame({
  user: initialUser,
  worldId,
  renderer,
  canvas,
  hud,
  ...hooks
}: {
  user: User;
  worldId: number;
  renderer: Renderer;
  canvas: HTMLCanvasElement;
  hud: Hud;
} & GameHooks) {
  let user = initialUser;
  let state: GameState = { phase: 'connecting' };
  let lastSent: Pose | undefined;
  let lastSentAt = 0;

  const hands = createHands({
    hud,
    canvas,
    pointAt: (event) => renderer.pointAt(event),
    send: (message) => conn.send(message),
  });
  const keys = keyboard(hands.key);
  Object.assign(window, { exploreState: () => state, exploreUser: () => user });
  const conn = connect({
    worldId,
    onMessage: (message) => {
      const was = state.phase;
      state = applyMessage(state, message);
      if (message.t === 'refused') hands.refused(message.reason, performance.now());
      if (message.t === 'sentHome') hooks.onSentHome(message.reason);
      if (message.t === 'screen' || message.t === 'correct') lastSent = undefined;
      if (message.t === 'screen' && state.phase !== 'connecting') {
        if (was === 'connecting' || message.arrival !== 'none') hooks.onArrive(message.arrival);
        if (state.phase !== 'waking') hooks.onScreen(state.place, state.patch);
      }
    },
    onStatus: hooks.onStatus,
  });

  let previous = performance.now();
  let frameId = requestAnimationFrame(function frame(now) {
    const dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;

    if (state.phase === 'playing') {
      const target = hands.walking();
      const { held, facing } = target
        ? steer(state.you, target)
        : { held: keys.held, facing: keys.lastPressed() };
      const { pose, exit } = step(state.place, state.you, held, dt, facing);
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
    /** Starts the session the server began with a wake-up. */
    wake: () => {
      if (state.phase !== 'waking') return;
      state = { ...state, phase: 'playing' };
      hooks.onScreen(state.place, state.patch);
    },
    /** A line in the hint bar for `forMs`, or the usual message time. */
    say: (text: string, forMs?: number) => hands.say(text, performance.now(), forMs),
    setUser: (saved: User) => {
      user = saved;
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
