import { fetchMap, fetchMe, logout, type User } from './api.ts';
import { avatarSheet, walkFrameRect } from './art/avatars.ts';
import { ambientMix, createAmbience } from './audio/ambience.ts';
import { createAudioEngine } from './audio/engine.ts';
import { tuneFor } from './audio/mood.ts';
import { createMusic } from './audio/music.ts';
import { loadArt } from './art/load.ts';
import { startGame, type GameStatus } from './game/game.ts';
import { canvasRenderer } from './game/render.ts';
import { mapView } from './map/map-view.ts';
import { authView, type AuthMode } from './ui/auth.ts';
import { avatarEditor } from './ui/avatar-editor.ts';
import type { DrawAvatar } from './ui/avatar-picker.ts';
import { h } from './ui/dom.ts';
import { BAR_PX_H, inventoryBar } from './ui/inventory-bar.ts';
import { soundSettings } from './ui/sound-settings.ts';
import './style.css';

type Place = 'game' | 'map';

type View =
  { kind: 'auth'; mode: AuthMode; then: Place } | { kind: 'game'; user: User } | { kind: 'map' };

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
const ambience = createAmbience(audio);
Object.assign(window, {
  exploreAudio: () => ({
    state: audio.state(),
    tune: music.current(),
    ambience: ambience.mix(),
    ambienceLoaded: ambience.loaded(),
    settings: audio.settings(),
  }),
});

let stopGame: (() => void) | undefined;

function gameView(user: User) {
  let avatar = user.avatar;
  const canvas = h('canvas', { class: 'game-canvas', 'aria-label': 'Game world' });
  const status = h('p', { class: 'status', role: 'status' });
  const hint = h('p', { class: 'hint-bar', role: 'status', hidden: true });
  const hud = { bar: inventoryBar(), hint, world: h('div', { class: 'world' }, canvas, hint) };
  const stage = h('div', { class: 'stage' }, hud.world, hud.bar.el);
  const view = h(
    'main',
    { class: 'game' },
    h(
      'header',
      { class: 'game-bar' },
      h('span', { class: 'who' }, user.username),
      status,
      avatarEditor(
        () => avatar,
        drawAvatar,
        (saved) => {
          avatar = saved.avatar;
          game.setAvatar(avatar);
        },
      ),
      soundSettings(audio),
      h('a', { class: 'link', href: '/map' }, 'Map'),
      h(
        'button',
        {
          type: 'button',
          class: 'link',
          onclick: () =>
            void logout().then(() => show({ kind: 'auth', mode: 'login', then: 'game' })),
        },
        'Log out',
      ),
    ),
    stage,
  );
  root.replaceChildren(view);
  Object.assign(window, {
    exploreHud: () => ({
      hint: hud.hint.textContent || undefined,
      hintHidden: hud.hint.hidden,
      slots: [...hud.bar.el.querySelectorAll<HTMLElement>('.slot')].map((slot) => ({
        key: slot.querySelector('.slot-key')!.textContent,
        count: slot.dataset.count === undefined ? undefined : Number(slot.dataset.count),
      })),
    }),
  });
  const game = startGame(
    user,
    canvasRenderer(canvas, stage, art, BAR_PX_H),
    canvas,
    hud,
    (s) => {
      status.textContent = STATUS_TEXT[s];
    },
    ({ screen }, patch) => {
      music.play(tuneFor(screen.biome, patch));
      ambience.set(ambientMix(screen));
    },
  );
  stopGame = () => {
    game.stop();
    music.stop();
    ambience.stop();
  };
}

function show(view: View) {
  stopGame?.();
  stopGame = undefined;
  switch (view.kind) {
    case 'auth':
      root.replaceChildren(
        authView({
          mode: view.mode,
          drawAvatar,
          onSwitch: (mode) => show({ kind: 'auth', mode, then: view.then }),
          onAuthenticated: (user) =>
            show(view.then === 'map' ? { kind: 'map' } : { kind: 'game', user }),
        }),
      );
      return;
    case 'map':
      root.replaceChildren(h('p', { class: 'loading' }, 'Loading the map…'));
      void fetchMap().then((data) => {
        const map = mapView(data);
        root.replaceChildren(map.el);
        map.mount();
        Object.assign(window, { exploreMap: map.state });
        stopGame = map.dispose;
      });
      return;
    case 'game':
      gameView(view.user);
      return;
  }
}

const place: Place = location.pathname === '/map' ? 'map' : 'game';
if (!initialUser) show({ kind: 'auth', mode: place === 'map' ? 'login' : 'signup', then: place });
else show(place === 'map' ? { kind: 'map' } : { kind: 'game', user: initialUser });
