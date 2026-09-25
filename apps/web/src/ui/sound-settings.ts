import type { AudioEngine } from '../audio/engine.ts';
import { h } from './dom.ts';

function slider(label: string, value: number, onInput: (v: number) => void) {
  const input = h('input', {
    type: 'range',
    min: '0',
    max: '100',
    step: '5',
    value: String(Math.round(value * 100)),
  });
  input.addEventListener('input', () => onInput(Number(input.value) / 100));
  return h('label', { class: 'sound-row' }, h('span', {}, label), input);
}

/** A Sound button that opens a small panel with mute and volume controls. */
export function soundSettings(engine: AudioEngine) {
  const settings = engine.settings();
  const mute = h('input', { type: 'checkbox' });
  mute.checked = settings.muted;
  mute.addEventListener('change', () => engine.update({ muted: mute.checked }));

  const panel = h(
    'div',
    {
      class: 'sound-panel',
      id: 'sound-panel',
      role: 'group',
      'aria-label': 'Sound settings',
      hidden: true,
    },
    h('label', { class: 'sound-row' }, mute, h('span', {}, 'Mute')),
    slider('Music', settings.music, (music) => engine.update({ music })),
    slider('Effects', settings.effects, (effects) => engine.update({ effects })),
  );
  const toggle = h(
    'button',
    { type: 'button', class: 'link', 'aria-expanded': 'false', 'aria-controls': 'sound-panel' },
    'Sound',
  );
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  // Arrow keys on a focused slider would otherwise also walk the player.
  panel.addEventListener('keydown', (event) => event.stopPropagation());

  return h('div', { class: 'sound' }, toggle, panel);
}
