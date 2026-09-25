import { DEFAULT_AVATAR } from '@explore/core';
import { ApiError, login, signup, type User } from '../api.ts';
import { avatarPicker, type DrawAvatar } from './avatar-picker.ts';
import { h } from './dom.ts';

export type AuthMode = 'login' | 'signup';

type Props = {
  mode: AuthMode;
  drawAvatar: DrawAvatar;
  onSwitch: (mode: AuthMode) => void;
  onAuthenticated: (user: User) => void;
};

function field(name: string, label: string, input: HTMLInputElement) {
  const error = h('p', { class: 'field-error', id: `${name}-error`, role: 'alert' });
  input.name = name;
  input.id = name;
  input.setAttribute('aria-describedby', error.id);
  return {
    el: h('label', { class: 'field', for: name }, h('span', {}, label), input, error),
    input,
    error,
  };
}

export function authView({ mode, drawAvatar, onSwitch, onAuthenticated }: Props) {
  const username = field(
    'username',
    'Username',
    h('input', { autocomplete: 'username', required: true, maxlength: '20', autofocus: true }),
  );
  const password = field(
    'password',
    'Password',
    h('input', {
      type: 'password',
      required: true,
      autocomplete: mode === 'signup' ? 'new-password' : 'current-password',
    }),
  );
  const formError = h('p', { class: 'form-error', role: 'alert' });
  const picker = mode === 'signup' ? avatarPicker(DEFAULT_AVATAR, drawAvatar) : undefined;
  const submit = h(
    'button',
    { type: 'submit', class: 'primary' },
    mode === 'signup' ? 'Create account' : 'Log in',
  );
  const errors: Record<string, HTMLElement> = {
    username: username.error,
    password: password.error,
  };

  const form = h(
    'form',
    {
      class: 'auth-form',
      novalidate: true,
      onsubmit: (event: Event) => {
        event.preventDefault();
        void submitForm();
      },
    },
    username.el,
    password.el,
    ...(picker ? [h('fieldset', {}, h('legend', {}, 'Your avatar'), picker.el)] : []),
    formError,
    submit,
  );

  async function submitForm() {
    for (const el of [...Object.values(errors), formError]) el.textContent = '';
    submit.disabled = true;
    const name = username.input.value.trim();
    const pass = password.input.value;
    try {
      const user = picker ? await signup(name, pass, picker.value()) : await login(name, pass);
      picker?.dispose();
      onAuthenticated(user);
    } catch (error) {
      const target = error instanceof ApiError && error.field ? errors[error.field] : undefined;
      (target ?? formError).textContent =
        error instanceof Error ? error.message : 'Something went wrong';
    } finally {
      submit.disabled = false;
    }
  }

  const other: AuthMode = mode === 'signup' ? 'login' : 'signup';
  return h(
    'main',
    { class: 'auth' },
    h('h1', {}, 'Geekity Explore'),
    h(
      'p',
      { class: 'tagline' },
      'A shared world that grows as you walk it. Start in the secret garden.',
    ),
    form,
    h(
      'p',
      { class: 'switch' },
      mode === 'signup' ? 'Already exploring? ' : 'New here? ',
      h(
        'button',
        {
          type: 'button',
          class: 'link',
          onclick: () => {
            picker?.dispose();
            onSwitch(other);
          },
        },
        mode === 'signup' ? 'Log in' : 'Create an account',
      ),
    ),
  );
}
