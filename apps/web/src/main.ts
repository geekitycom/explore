import { fetchMap, fetchMe, logout, type User } from './api.ts';
import { avatarSheet, walkFrameRect } from './art/avatars.ts';
import { ambientMix, createAmbience } from './audio/ambience.ts';
import { createAudioEngine } from './audio/engine.ts';
import { tuneFor } from './audio/mood.ts';
import { createMusic } from './audio/music.ts';
import { loadArt } from './art/load.ts';
import { startGame, type GameStatus } from './game/game.ts';
import { typing } from './game/input.ts';
import { canvasRenderer } from './game/render.ts';
import { mapView } from './map/map-view.ts';
import { authView, type AuthMode } from './ui/auth.ts';
import { avatarEditor } from './ui/avatar-editor.ts';
import { avatarStep } from './ui/avatar-step.ts';
import type { DrawAvatar } from './ui/avatar-picker.ts';
import { h } from './ui/dom.ts';
import { BAR_PX_H, inventoryBar } from './ui/inventory-bar.ts';
import { soundSettings } from './ui/sound-settings.ts';
import { wakeUp } from './ui/wake.ts';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-600.css';
import './style.css';

type Place = 'game' | 'map';

type MapOverlay = { el: HTMLElement; dispose?: () => void };

type View =
  | { kind: 'auth'; mode: AuthMode; then: Place }
  | { kind: 'avatar'; user: User; then: Place }
  | { kind: 'game'; user: User }
  | { kind: 'map' };

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
  const hint = h('button', {
    type: 'button',
    class: 'hint-bar',
    'aria-live': 'polite',
    hidden: true,
  });
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
      h(
        'a',
        {
          class: 'link',
          href: '/map',
          onclick: (e) => {
            if (e instanceof MouseEvent && (e.metaKey || e.ctrlKey || e.shiftKey)) return;
            e.preventDefault();
            toMap();
          },
        },
        'Map',
      ),
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
  let wake: ReturnType<typeof wakeUp> | undefined;
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
    () => {
      music.stop();
      wake?.dispose();
      wake = wakeUp(() => {
        audio.unlock();
        game.wake();
      });
      hud.world.append(wake.el);
    },
  );

  let overlay: MapOverlay | undefined;
  const openMap = () => {
    if (overlay) return;
    const opened: MapOverlay = {
      el: h('div', { class: 'map-overlay' }, h('p', { class: 'loading' }, 'Loading the map…')),
    };
    overlay = opened;
    game.pauseKeys(true);
    view.inert = true;
    root.append(opened.el);
    void fetchMap().then((data) => {
      if (overlay !== opened) return;
      const map = mapView(data, () => history.back());
      opened.el.replaceChildren(map.el);
      map.mount();
      opened.dispose = map.dispose;
      Object.assign(window, { exploreMap: map.state });
    });
  };
  const closeMap = () => {
    if (!overlay) return;
    overlay.dispose?.();
    overlay.el.remove();
    overlay = undefined;
    view.inert = false;
    game.pauseKeys(false);
  };
  // The URL is the map's source of truth, so the browser's Back and Forward open and close it too.
  const syncMap = () => (location.pathname === '/map' ? openMap() : closeMap());
  const toMap = () => {
    history.pushState(null, '', '/map');
    syncMap();
  };
  const mapKeys = (e: KeyboardEvent) => {
    if (typing(e) || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'KeyM' || (overlay && e.code === 'Escape')) {
      e.preventDefault();
      if (overlay) history.back();
      else toMap();
    }
  };
  window.addEventListener('popstate', syncMap);
  window.addEventListener('keydown', mapKeys);

  stopGame = () => {
    window.removeEventListener('popstate', syncMap);
    window.removeEventListener('keydown', mapKeys);
    closeMap();
    wake?.dispose();
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
          onSwitch: (mode) => show({ kind: 'auth', mode, then: view.then }),
          onAuthenticated: (user) => enter(user, view.then),
        }),
      );
      return;
    case 'avatar':
      root.replaceChildren(avatarStep(view.user, drawAvatar, (user) => enter(user, view.then)));
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

/** Where a signed-in player goes next: the avatar step until they have chosen one, then `place`. */
function enter(user: User, place: Place) {
  if (!user.avatarChosen) show({ kind: 'avatar', user, then: place });
  else show(place === 'map' ? { kind: 'map' } : { kind: 'game', user });
}

const place: Place = location.pathname === '/map' ? 'map' : 'game';
if (initialUser) enter(initialUser, place);
else show({ kind: 'auth', mode: 'login', then: place });
