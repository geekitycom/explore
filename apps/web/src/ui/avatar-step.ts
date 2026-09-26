import { saveProfile, type User } from '../api.ts';
import { avatarPicker, type DrawAvatar } from './avatar-picker.ts';
import { h } from './dom.ts';

/** The step after creating an account, shown until the player saves an avatar. */
export function avatarStep(user: User, draw: DrawAvatar, onSaved: (user: User) => void) {
  const picker = avatarPicker(user.avatar, draw);
  const error = h('p', { class: 'form-error', role: 'alert' });
  const save = h('button', { type: 'submit', class: 'primary' }, 'Start exploring');

  async function submit() {
    error.textContent = '';
    save.disabled = true;
    try {
      const saved = await saveProfile({ displayName: user.displayName, avatar: picker.value() });
      picker.dispose();
      onSaved(saved);
    } catch (e) {
      error.textContent = e instanceof Error ? e.message : 'Something went wrong';
      save.disabled = false;
    }
  }

  return h(
    'main',
    { class: 'auth' },
    h('h1', {}, 'Choose your avatar'),
    h(
      'p',
      { class: 'tagline' },
      `This is how other explorers see you, ${user.displayName}. You can change it later from the game bar.`,
    ),
    h(
      'form',
      {
        class: 'auth-form',
        onsubmit: (event: Event) => {
          event.preventDefault();
          void submit();
        },
      },
      picker.el,
      error,
      save,
    ),
  );
}
