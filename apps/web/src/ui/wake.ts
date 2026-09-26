import { typing } from '../game/input.ts';
import { h } from './dom.ts';

export const WAKE_TEXT =
  'You wake up in a secret garden. You feel the grass between your toes. Click to start.';

/**
 * Covers the world in black that opens like eyes from a seam across the middle, then shows the
 * wake-up message. A click anywhere on it or Space, once the message shows, removes it and calls
 * `onStart` inside that gesture, so the start can unlock audio. Space is kept from everything
 * else while it is up.
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

  const start = () => {
    if (!ready) return;
    dispose();
    onStart();
  };
  const key = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || typing(event) || el.closest('[inert]')) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) start();
  };
  window.addEventListener('keydown', key, { capture: true });
  el.addEventListener('click', start);

  const dispose = () => {
    window.removeEventListener('keydown', key, { capture: true });
    el.remove();
  };
  return { el, dispose };
}
