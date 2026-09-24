import { SKIN_TONES, CLOTH_COLORS, HAIR_COLORS, type Avatar } from '@explore/core';
import { fetchMe, logout, type User } from './api.ts';
import { authView, type AuthMode } from './ui/auth.ts';
import type { DrawAvatar } from './ui/avatar-picker.ts';
import { h } from './ui/dom.ts';
import './style.css';

type View = { kind: 'loading' } | { kind: 'auth'; mode: AuthMode } | { kind: 'game'; user: User };

const root = document.querySelector<HTMLElement>('#app')!;

const drawAvatar: DrawAvatar = (ctx, avatar: Avatar) => {
  ctx.fillStyle = HAIR_COLORS[avatar.hairColor];
  ctx.fillRect(4, 1, 8, 3);
  ctx.fillStyle = SKIN_TONES[avatar.skin];
  ctx.fillRect(4, 4, 8, 4);
  ctx.fillStyle = CLOTH_COLORS[avatar.shirt];
  ctx.fillRect(4, 8, 8, 4);
  ctx.fillStyle = CLOTH_COLORS[avatar.pants];
  ctx.fillRect(4, 12, 8, 3);
};

function show(view: View) {
  switch (view.kind) {
    case 'loading':
      root.replaceChildren(h('p', { class: 'loading' }, 'Loading…'));
      return;
    case 'auth':
      root.replaceChildren(
        authView({
          mode: view.mode,
          drawAvatar,
          onSwitch: (mode) => show({ kind: 'auth', mode }),
          onAuthenticated: (user) => show({ kind: 'game', user }),
        }),
      );
      return;
    case 'game':
      root.replaceChildren(
        h(
          'main',
          { class: 'game' },
          h('p', {}, `Welcome, ${view.user.username}.`),
          h(
            'button',
            {
              type: 'button',
              onclick: () => void logout().then(() => show({ kind: 'auth', mode: 'login' })),
            },
            'Log out',
          ),
        ),
      );
      return;
  }
}

show({ kind: 'loading' });
const user = await fetchMe();
show(user ? { kind: 'game', user } : { kind: 'auth', mode: 'signup' });
