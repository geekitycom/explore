import { DISPLAY_NAME_MAX } from '@explore/core';
import { ApiError, login, signup, type User } from '../api.ts';
import { h } from './dom.ts';

export type AuthMode = 'login' | 'signup';

type Props = {
  mode: AuthMode;
  onSwitch: (mode: AuthMode) => void;
  onAuthenticated: (user: User) => void;
};

const COPY = {
  login: {
    title: 'Geekity Explore',
    tagline: 'A shared world that grows as you walk it. Welcome back.',
    submit: 'Log in',
    switchPrompt: 'New here? ',
    switchTo: 'Create an account',
  },
  signup: {
    title: 'Create your account',
    tagline:
      'Pick a username to log in with and a name other explorers see. You choose how you look next.',
    submit: 'Create account',
    switchPrompt: 'Already exploring? ',
    switchTo: 'Log in',
  },
} satisfies Record<AuthMode, Record<string, string>>;

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

export function authView({ mode, onSwitch, onAuthenticated }: Props) {
  const copy = COPY[mode];
  const username = field(
    'username',
    'Username',
    h('input', { autocomplete: 'username', required: true, maxlength: '20', autofocus: true }),
  );
  const displayName =
    mode === 'signup'
      ? field(
          'displayName',
          'Display name',
          h('input', {
            required: true,
            maxlength: String(DISPLAY_NAME_MAX),
            autocomplete: 'nickname',
          }),
        )
      : undefined;
  const newPassword = mode === 'signup' ? 'new-password' : 'current-password';
  const password = field(
    'password',
    'Password',
    h('input', { type: 'password', required: true, autocomplete: newPassword }),
  );
  const retype =
    mode === 'signup'
      ? field(
          'password-again',
          'Password again',
          h('input', { type: 'password', required: true, autocomplete: 'new-password' }),
        )
      : undefined;
  const formError = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'primary' }, copy.submit);
  const errors: Record<string, HTMLElement> = {
    username: username.error,
    password: password.error,
    ...(displayName ? { displayName: displayName.error } : {}),
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
    ...(displayName ? [displayName.el] : []),
    password.el,
    ...(retype ? [retype.el] : []),
    formError,
    submit,
  );

  async function submitForm() {
    for (const el of [...Object.values(errors), formError]) el.textContent = '';
    const name = username.input.value.trim();
    const pass = password.input.value;
    if (retype) {
      retype.error.textContent = '';
      if (retype.input.value !== pass) {
        retype.error.textContent = "The passwords don't match";
        retype.input.focus();
        return;
      }
    }
    submit.disabled = true;
    try {
      onAuthenticated(
        await (displayName
          ? signup({ username: name, displayName: displayName.input.value, password: pass })
          : login(name, pass)),
      );
    } catch (error) {
      const target = error instanceof ApiError && error.field ? errors[error.field] : undefined;
      (target ?? formError).textContent =
        error instanceof Error ? error.message : 'Something went wrong';
    } finally {
      submit.disabled = false;
    }
  }

  return h(
    'main',
    { class: `auth auth-${mode}` },
    h('h1', {}, copy.title),
    h('p', { class: 'tagline' }, copy.tagline),
    form,
    h(
      'p',
      { class: 'switch' },
      copy.switchPrompt,
      h(
        'button',
        {
          type: 'button',
          class: 'link',
          onclick: () => onSwitch(mode === 'signup' ? 'login' : 'signup'),
        },
        copy.switchTo,
      ),
    ),
  );
}
