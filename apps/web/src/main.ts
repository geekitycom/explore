import { fetchMap, fetchMe, logout, type User, type Visit } from './api.ts';
import { avatarSheet, walkFrameRect } from './art/avatars.ts';
import { ambientMix, createAmbience } from './audio/ambience.ts';
import { createAudioEngine } from './audio/engine.ts';
import { playWhoosh } from './audio/whoosh.ts';
import { tuneFor } from './audio/mood.ts';
import { createMusic } from './audio/music.ts';
import { loadArt } from './art/load.ts';
import { startGame, type GameStatus } from './game/game.ts';
import { typing } from './game/input.ts';
import { canvasRenderer } from './game/render.ts';
import { mapView } from './map/map-view.ts';
import { authView, type AuthMode } from './ui/auth.ts';
import { avatarStep } from './ui/avatar-step.ts';
import type { DrawAvatar } from './ui/avatar-picker.ts';
import { h } from './ui/dom.ts';
import { friendsMenu } from './ui/friends.ts';
import { BAR_PX_H, inventoryBar } from './ui/inventory-bar.ts';
import { profileEditor } from './ui/profile-editor.ts';
import { soundSettings } from './ui/sound-settings.ts';
import { wakeUp } from './ui/wake.ts';
import '@fontsource/pixelify-sans/latin-400.css';
import '@fontsource/pixelify-sans/latin-600.css';
import './style.css';

/**
 * The URL says where the player is: `/` is home, `/worlds/:id` is a visit, and `/map` after
 * either opens the map. A reload keeps a visit, and Back leaves it.
 */
type Route = { worldId: number | undefined; map: boolean };

type MapOverlay = { el: HTMLElement; dispose?: () => void };

type View =
  | { kind: 'auth'; mode: AuthMode; then: Route }
  | { kind: 'avatar'; user: User; then: Route }
  | { kind: 'game'; user: User; worldId: number | undefined; notice?: string }
  | { kind: 'map'; user: User; worldId: number | undefined };

const STATUS_TEXT: Record<GameStatus, string> = {
  connecting: 'Connecting…',
  open: '',
  reconnecting: 'Connection lost. Reconnecting…',
  replaced: 'You opened the game in another tab. This one is paused.',
  refused: 'That world is not open to you.',
  departed: 'Going home…',
  signedOut: 'You were logged out.',
};

/** How long the arrival line and a notice about being sent home stay up. */
const NOTICE_MS = 6000;

function parseRoute(pathname: string): Route {
  const visit = /^\/worlds\/(\d+)(\/map)?$/.exec(pathname);
  if (visit) return { worldId: Number(visit[1]), map: visit[2] !== undefined };
  return { worldId: undefined, map: pathname === '/map' };
}

function pathFor({ worldId, map }: Route): string {
  const world = worldId === undefined ? '' : `/worlds/${worldId}`;
  return `${world}${map ? '/map' : ''}` || '/';
}

/** The host's name travels in the history entry, so a reload of a visit still knows it. */
const hostNameInHistory = (): string | undefined => {
  const state: unknown = history.state;
  const host =
    state !== null && typeof state === 'object' && 'host' in state ? state.host : undefined;
  return typeof host === 'string' ? host : undefined;
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

function gameView(initialUser: User, worldId: number | undefined, notice: string | undefined) {
  let user = initialUser;
  const here = worldId ?? user.home;
  const visiting = here !== user.home;
  const hostName = visiting ? hostNameInHistory() : undefined;
  const canvas = h('canvas', { class: 'game-canvas', 'aria-label': 'Game world' });
  const who = h('span', { class: 'who' }, user.displayName);
  const status = h('p', { class: 'status', role: 'status' });
  const hint = h('button', {
    type: 'button',
    class: 'hint-bar',
    'aria-live': 'polite',
    hidden: true,
  });
  const hud = { bar: inventoryBar(), hint, world: h('div', { class: 'world' }, canvas, hint) };
  const stage = h('div', { class: 'stage' }, hud.world, hud.bar.el);

  /** The one way out of a world: to a friend's world, or home, with a line to show on arrival. */
  const travelTo = (route: Route, state: unknown, arrivalNotice?: string) => {
    history.pushState(state, '', pathFor(route));
    show({
      kind: 'game',
      user,
      worldId: route.worldId,
      ...(arrivalNotice && { notice: arrivalNotice }),
    });
  };
  const visit = (world: Visit) => travelTo({ worldId: world.id, map: false }, { host: world.host });
  const goHome = (reason?: string) => travelTo({ worldId: undefined, map: false }, null, reason);

  const view = h(
    'main',
    { class: 'game' },
    h(
      'header',
      { class: 'game-bar' },
      who,
      status,
      profileEditor(
        () => user,
        drawAvatar,
        (saved) => {
          user = saved;
          who.textContent = user.displayName;
          game.setUser(user);
        },
      ),
      soundSettings(audio),
      friendsMenu({
        home: user.home,
        here,
        hostName,
        onVisit: visit,
        onGoHome: () => game.leave(),
      }),
      ...(visiting
        ? [h('button', { type: 'button', class: 'link', onclick: () => game.leave() }, 'Go home')]
        : []),
      h(
        'a',
        {
          class: 'link',
          href: pathFor({ worldId, map: true }),
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
            void logout().then(() =>
              show({ kind: 'auth', mode: 'login', then: { worldId: undefined, map: false } }),
            ),
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
        label: slot.getAttribute('aria-label'),
        count: slot.dataset.count === undefined ? undefined : Number(slot.dataset.count),
      })),
    }),
    exploreWorld: () => ({ here, home: user.home, visiting, hostName }),
  });
  let wake: ReturnType<typeof wakeUp> | undefined;
  const game = startGame({
    user,
    worldId: here,
    renderer: canvasRenderer(canvas, stage, art, BAR_PX_H),
    canvas,
    hud,
    onStatus: (s) => {
      if (s === 'refused' && visiting) {
        goHome("That world isn't open to you right now, so you're back home.");
        return;
      }
      if (s === 'signedOut') {
        show({ kind: 'auth', mode: 'login', then: parseRoute(location.pathname) });
        return;
      }
      status.textContent = STATUS_TEXT[s];
    },
    onScreen: ({ screen }, patch) => {
      music.play(tuneFor(screen.biome, patch));
      ambience.set(ambientMix(screen));
    },
    onArrive: (arrival) => {
      if (arrival === 'wake') {
        music.stop();
        wake?.dispose();
        wake = wakeUp(() => {
          audio.unlock();
          game.wake();
        });
        hud.world.append(wake.el);
      } else if (arrival === 'visit') {
        game.say(`You arrive in ${hostName ?? 'your friend'}'s world.`, NOTICE_MS);
      }
      if (notice) {
        game.say(notice, NOTICE_MS);
        notice = undefined;
      }
    },
    onPortal: () => audio.ifReady(({ ctx, effects }) => playWhoosh(ctx, effects, ctx.currentTime)),
    onDepart: goHome,
  });

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
    void fetchMap(here).then((data) => {
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
  // The URL is the source of truth, so Back and Forward open and close the map and end a visit.
  const syncRoute = () => {
    const route = parseRoute(location.pathname);
    if ((route.worldId ?? user.home) !== here) {
      show({ kind: 'game', user, worldId: route.worldId });
      return;
    }
    if (route.map) openMap();
    else closeMap();
  };
  const toMap = () => {
    history.pushState(history.state, '', pathFor({ worldId, map: true }));
    syncRoute();
  };
  const mapKeys = (e: KeyboardEvent) => {
    if (typing(e) || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'KeyM' || (overlay && e.code === 'Escape')) {
      e.preventDefault();
      if (overlay) history.back();
      else toMap();
    }
  };
  window.addEventListener('popstate', syncRoute);
  window.addEventListener('keydown', mapKeys);

  stopGame = () => {
    window.removeEventListener('popstate', syncRoute);
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
      void fetchMap(view.worldId ?? view.user.home).then((data) => {
        const map = mapView(data);
        root.replaceChildren(map.el);
        map.mount();
        Object.assign(window, { exploreMap: map.state });
        stopGame = map.dispose;
      });
      return;
    case 'game':
      gameView(view.user, view.worldId, view.notice);
      return;
  }
}

/** Where a signed-in player goes next: the avatar step until they have chosen one, then `route`. */
function enter(user: User, route: Route) {
  if (!user.avatarChosen) show({ kind: 'avatar', user, then: route });
  else if (route.map) show({ kind: 'map', user, worldId: route.worldId });
  else show({ kind: 'game', user, worldId: route.worldId });
}

const route = parseRoute(location.pathname);
if (initialUser) enter(initialUser, route);
else show({ kind: 'auth', mode: 'login', then: route });
