import { DISPLAY_NAME_MAX } from '@explore/core';
import { ApiError, saveProfile, type User } from '../api.ts';
import { avatarPicker, type DrawAvatar } from './avatar-picker.ts';
import { h } from './dom.ts';

/** A game-bar button that opens a dialog to change the display name and the avatar together. */
export function profileEditor(
  current: () => User,
  draw: DrawAvatar,
  onSaved: (user: User) => void,
) {
  const dialog = h('dialog', { class: 'avatar-dialog', 'aria-labelledby': 'profile-dialog-title' });
  // Arrow keys and WASD in the dialog would otherwise also walk the player.
  dialog.addEventListener('keydown', (event) => event.stopPropagation());

  const open = () => {
    const user = current();
    const name = h('input', {
      id: 'profile-name',
      name: 'displayName',
      required: true,
      maxlength: String(DISPLAY_NAME_MAX),
      autocomplete: 'nickname',
      'aria-describedby': 'profile-name-error',
    });
    name.value = user.displayName;
    const nameError = h('p', { class: 'field-error', id: 'profile-name-error', role: 'alert' });
    const picker = avatarPicker(user.avatar, draw);
    const error = h('p', { class: 'form-error', role: 'alert' });
    const save = h('button', { type: 'submit', class: 'primary' }, 'Save');
    const form = h(
      'form',
      {
        class: 'avatar-form',
        novalidate: true,
        onsubmit: (event: Event) => {
          event.preventDefault();
          void submit();
        },
      },
      h('h2', { id: 'profile-dialog-title' }, 'Your name and avatar'),
      h('label', { class: 'field', for: name.id }, h('span', {}, 'Display name'), name, nameError),
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
      nameError.textContent = '';
      save.disabled = true;
      try {
        onSaved(await saveProfile({ displayName: name.value, avatar: picker.value() }));
        dialog.close();
      } catch (e) {
        const target = e instanceof ApiError && e.field === 'displayName' ? nameError : error;
        target.textContent = e instanceof Error ? e.message : 'Something went wrong';
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
      'Name & avatar',
    ),
    dialog,
  );
}
