import type { Avatar } from '@explore/core';
import { updateAvatar, type User } from '../api.ts';
import { avatarPicker, type DrawAvatar } from './avatar-picker.ts';
import { h } from './dom.ts';

/** An Avatar button that opens the signup picker in a dialog, prefilled with the current look. */
export function avatarEditor(
  current: () => Avatar,
  draw: DrawAvatar,
  onSaved: (user: User) => void,
) {
  const dialog = h('dialog', { class: 'avatar-dialog', 'aria-labelledby': 'avatar-dialog-title' });
  // Arrow keys and WASD in the dialog would otherwise also walk the player.
  dialog.addEventListener('keydown', (event) => event.stopPropagation());

  const open = () => {
    const picker = avatarPicker(current(), draw);
    const error = h('p', { class: 'form-error', role: 'alert' });
    const save = h('button', { type: 'submit', class: 'primary' }, 'Save');
    const form = h(
      'form',
      {
        class: 'avatar-form',
        onsubmit: (event: Event) => {
          event.preventDefault();
          void submit();
        },
      },
      h('h2', { id: 'avatar-dialog-title' }, 'Your avatar'),
      picker.el,
      error,
      h(
        'div',
        { class: 'dialog-actions' },
        h('button', { type: 'button', class: 'link', onclick: () => dialog.close() }, 'Cancel'),
        save,
      ),
    );

    async function submit() {
      error.textContent = '';
      save.disabled = true;
      try {
        onSaved(await updateAvatar(picker.value()));
        dialog.close();
      } catch (e) {
        error.textContent = e instanceof Error ? e.message : 'Something went wrong';
      } finally {
        save.disabled = false;
      }
    }

    dialog.addEventListener('close', () => picker.dispose(), { once: true });
    dialog.replaceChildren(form);
    dialog.showModal();
  };

  return h(
    'div',
    {},
    h(
      'button',
      { type: 'button', class: 'link', 'aria-haspopup': 'dialog', onclick: open },
      'Avatar',
    ),
    dialog,
  );
}
