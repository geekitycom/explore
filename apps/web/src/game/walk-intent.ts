import { TILE, type Point } from '@explore/core';

/**
 * Where the pointer is walking the player. A held press walks while it lasts; the second press
 * of a double-click or double-tap, once lifted, leaves a queued walk that carries on alone.
 */
export type WalkIntent =
  | { readonly kind: 'none' }
  | { readonly kind: 'held'; readonly target: Point; readonly onRelease: 'stop' | 'queue' }
  | { readonly kind: 'queued'; readonly target: Point };

export type WalkEvent =
  /** A press that walks; `double` when it completes a double-click or double-tap. */
  | { readonly kind: 'press'; readonly target: Point; readonly double: boolean }
  | { readonly kind: 'drag'; readonly target: Point }
  | { readonly kind: 'release' }
  /** A press that does something other than walk, or a press the browser cancelled. */
  | { readonly kind: 'cancel' }
  /** Arrival, a movement key, or a new screen: ends a queued walk, not a held one. */
  | { readonly kind: 'settle' };

export const STANDING: WalkIntent = { kind: 'none' };

export function nextWalk(intent: WalkIntent, event: WalkEvent): WalkIntent {
  switch (event.kind) {
    case 'press':
      return {
        kind: 'held',
        target: event.target,
        onRelease: event.double ? 'queue' : 'stop',
      };
    case 'drag':
      return intent.kind === 'held' ? { ...intent, target: event.target } : intent;
    case 'release':
      if (intent.kind !== 'held') return intent;
      return intent.onRelease === 'queue' ? { kind: 'queued', target: intent.target } : STANDING;
    case 'cancel':
      return STANDING;
    case 'settle':
      return intent.kind === 'queued' ? STANDING : intent;
  }
}

export type Tap = { readonly at: number; readonly point: Point };

const DOUBLE_MS = 400;
const DOUBLE_PX = TILE / 2;

/** Whether a walk press at `tap` is the second of a double-click or double-tap after `previous`. */
export function isDouble(previous: Tap | undefined, tap: Tap): boolean {
  if (!previous) return false;
  const near = Math.hypot(tap.point.x - previous.point.x, tap.point.y - previous.point.y);
  return tap.at - previous.at <= DOUBLE_MS && near <= DOUBLE_PX;
}
