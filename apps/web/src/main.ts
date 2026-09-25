import { fetchMe, logout, type User } from './api.ts';
import { avatarSheet, walkFrameRect } from './art/avatars.ts';
import { createAudioEngine } from './audio/engine.ts';
import { tuneFor } from './audio/mood.ts';
import { createMusic } from './audio/music.ts';
import { loadArt } from './art/load.ts';
import { startGame, type GameStatus } from './game/game.ts';
import { canvasRenderer } from './game/render.ts';
import { authView, type AuthMode } from './ui/auth.ts';
import type { DrawAvatar } from './ui/avatar-picker.ts';
import { h } from './ui/dom.ts';
import { soundSettings } from './ui/sound-settings.ts';
import './style.css';

type View = { kind: 'loading' } | { kind: 'auth'; mode: AuthMode } | { kind: 'game'; user: User };

const STATUS_TEXT: Record<GameStatus, string> = {
  connecting: 'Connecting…',
  open: '',
  reconnecting: 'Connection lost. Reconnecting…',
  replaced: 'You opened the game in another tab. This one is paused.',
};

const root = document.querySelector<HTMLElement>('#app')!;
root.replaceChildren(h('p', { class: 'loading' }, 'Loading…'));
const [art, initialUser] = await Promise.all([loadArt(), fetchMe()]);

const drawAvatar: DrawAvatar = (ctx, avatar, dir, frame) => {
  const src = walkFrameRect(dir, frame);
  ctx.drawImage(avatarSheet(avatar, art), src.x, src.y, src.w, src.h, 0, 0, src.w, src.h);
};

const audio = createAudioEngine();
const music = createMusic(audio);
Object.assign(window, {
  exploreAudio: () => ({ state: audio.state(), tune: music.current(), settings: audio.settings() }),
});

let stopGame: (() => void) | undefined;

function gameView(user: User) {
  const canvas = h('canvas', { class: 'game-canvas', 'aria-label': 'Game world' });
  const status = h('p', { class: 'status', role: 'status' });
  const view = h(
    'main',
    { class: 'game' },
    h(
      'header',
      { class: 'game-bar' },
      h('span', { class: 'who' }, user.username),
      status,
      soundSettings(audio),
      h(
        'button',
        {
          type: 'button',
          class: 'link',
          onclick: () => void logout().then(() => show({ kind: 'auth', mode: 'login' })),
        },
        'Log out',
      ),
    ),
    h('div', { class: 'stage' }, canvas),
    h('p', { class: 'hint' }, 'Arrow keys or WASD to walk. Walk off an edge to explore.'),
  );
  root.replaceChildren(view);
  const game = startGame(
    user,
    canvasRenderer(canvas, art),
    (s) => {
      status.textContent = STATUS_TEXT[s];
    },
    (screen) => music.play(tuneFor(screen)),
  );
  stopGame = () => {
    game.stop();
    music.stop();
  };
}

function show(view: View) {
  stopGame?.();
  stopGame = undefined;
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
      gameView(view.user);
      return;
  }
}

show(initialUser ? { kind: 'game', user: initialUser } : { kind: 'auth', mode: 'signup' });
