import { slotOf, type Dir, type Slot } from '@explore/core';

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'n',
  KeyW: 'n',
  ArrowDown: 's',
  KeyS: 's',
  ArrowLeft: 'w',
  KeyA: 'w',
  ArrowRight: 'e',
  KeyD: 'e',
};

export type KeyAction =
  | { readonly kind: 'interact' }
  | { readonly kind: 'slot'; readonly slot: Slot }
  | { readonly kind: 'cancel' };

const INTERACT: KeyAction = { kind: 'interact' };
const CANCEL: KeyAction = { kind: 'cancel' };

/** Digit1..Digit9 are slots 0..8 and Digit0 is slot 9, as on the bar. */
function keyAction(code: string): KeyAction | undefined {
  if (code === 'KeyE' || code === 'Space') return INTERACT;
  if (code === 'Escape') return CANCEL;
  const digit = /^Digit(\d)$/.exec(code)?.[1];
  const slot = digit === undefined ? undefined : slotOf((Number(digit) + 9) % 10);
  return slot === undefined ? undefined : { kind: 'slot', slot };
}

const within = (target: EventTarget | null, selector: string) =>
  target instanceof Element && target.closest(selector) !== null;

export const typing = (event: KeyboardEvent) =>
  within(event.target, 'input, textarea, [contenteditable]');

/** Tracks held movement keys and reports action keys. Releases everything on blur so a key can't stick down. */
export function keyboard(onAction: (action: KeyAction) => void) {
  const held = new Set<Dir>();
  let lastPressed: Dir | undefined;
  let paused = false;

  const down = (event: KeyboardEvent) => {
    if (paused || typing(event)) return;
    const dir = KEY_DIRS[event.code];
    if (dir) {
      event.preventDefault();
      if (!held.has(dir)) lastPressed = dir;
      held.add(dir);
      return;
    }
    const action = keyAction(event.code);
    if (!action) return;
    // Space still presses a focused button, and Escape still closes a dialog.
    if (event.code === 'Space' && within(event.target, 'button, a, select, summary')) return;
    if (action !== CANCEL) event.preventDefault();
    if (!event.repeat) onAction(action);
  };
  const up = (event: KeyboardEvent) => {
    const dir = KEY_DIRS[event.code];
    if (dir) held.delete(dir);
  };
  const clear = () => held.clear();

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', clear);

  return {
    held: held as ReadonlySet<Dir>,
    lastPressed: () => lastPressed,
    /** While paused, keys are left to whatever sits over the game, and nothing stays held. */
    pause: (on: boolean) => {
      paused = on;
      held.clear();
    },
    dispose: () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    },
  };
}
