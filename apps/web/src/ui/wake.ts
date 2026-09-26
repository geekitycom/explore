import { typing } from '../game/input.ts';
import { h } from './dom.ts';

export const WAKE_TEXT =
  'You wake up in a secret garden. You feel the grass between your toes. Press [space] to start.';

/**
 * Covers the world in black that opens like eyes from a seam across the middle, then shows the
 * wake-up message. Space, once the message shows, removes it and calls `onStart` inside the key
 * press, so the start can unlock audio. Space is kept from everything else while it is up.
 */
export function wakeUp(onStart: () => void) {
  const text = h('p', { class: 'wake-text', role: 'status' }, WAKE_TEXT);
  const el = h(
    'div',
    { class: 'wake' },
    h('div', { class: 'lid lid-top' }),
    h('div', { class: 'lid lid-bottom' }),
    text,
  );
  let ready = false;
  text.addEventListener('animationend', () => (ready = true), { once: true });

  const key = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || typing(event) || el.closest('[inert]')) return;
    event.preventDefault();
    event.stopPropagation();
    if (!ready || event.repeat) return;
    dispose();
    onStart();
  };
  window.addEventListener('keydown', key, { capture: true });

  const dispose = () => {
    window.removeEventListener('keydown', key, { capture: true });
    el.remove();
  };
  return { el, dispose };
}
