import { closeVisitors, fetchVisitors, openVisitors, redeemCode, type Visit } from '../api.ts';
import { h } from './dom.ts';

export type FriendsOptions = {
  /** The player's own world, and the one they are in now. */
  home: number;
  here: number;
  /** Who the player is visiting, when known. */
  hostName: string | undefined;
  onVisit: (world: Visit) => void;
  onGoHome: () => void;
};

/**
 * A game-bar button that opens the Friends dialog: open your world for visitors and read out
 * the code, close it again, visit a friend by typing their code, or go home.
 */
export function friendsMenu({ home, here, hostName, onVisit, onGoHome }: FriendsOptions) {
  const dialog = h('dialog', { class: 'friends-dialog', 'aria-labelledby': 'friends-title' });
  // Arrow keys and WASD in the dialog would otherwise also walk the player.
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  const visiting = here !== home;

  const yoursTitle = () => h('h3', { id: 'friends-yours' }, 'Your world');
  const yoursLoading = () =>
    h(
      'section',
      { class: 'friends-section', 'aria-labelledby': 'friends-yours' },
      yoursTitle(),
      h('p', {}, 'One moment…'),
    );

  /** Open or closed, with the control that flips it; each change redraws the section. */
  const yourWorld = (code: string | null) => {
    const section = h('section', { class: 'friends-section', 'aria-labelledby': 'friends-yours' });
    const title = yoursTitle();
    const busy = h('p', { class: 'form-error', role: 'alert' });
    const change = async (
      request: () => Promise<{ code: string | null }>,
      button: HTMLButtonElement,
    ) => {
      button.disabled = true;
      try {
        section.replaceWith(yourWorld((await request()).code));
      } catch (e) {
        busy.textContent = e instanceof Error ? e.message : 'Something went wrong';
        button.disabled = false;
      }
    };
    if (code === null) {
      const open = h('button', { type: 'button', class: 'primary' }, 'Open for visitors');
      open.addEventListener('click', () => void change(() => openVisitors(home), open));
      section.replaceChildren(
        title,
        h(
          'p',
          {},
          'Your world is closed. Open it to get a code your friends can type to come and play.',
        ),
        busy,
        h('div', { class: 'dialog-actions' }, open),
      );
    } else {
      const close = h('button', { type: 'button', class: 'link' }, 'Close to visitors');
      close.addEventListener(
        'click',
        () =>
          void change(async () => {
            await closeVisitors(home);
            return { code: null };
          }, close),
      );
      section.replaceChildren(
        title,
        h('p', {}, 'Your world is open. Friends can come in with this code:'),
        h('p', { class: 'visit-code', 'aria-label': 'Visit code' }, code),
        h(
          'p',
          { class: 'friends-note' },
          'Anyone who types it joins you here while you stay. Closing sends everyone home.',
        ),
        busy,
        h('div', { class: 'dialog-actions' }, close),
      );
    }
    return section;
  };

  const awayFromHome = () => {
    const goHome = h('button', { type: 'button', class: 'primary' }, 'Go home');
    goHome.addEventListener('click', () => {
      dialog.close();
      onGoHome();
    });
    return h(
      'section',
      { class: 'friends-section', 'aria-labelledby': 'friends-away' },
      h('h3', { id: 'friends-away' }, `You are in ${hostName ?? 'a friend'}'s world`),
      h(
        'p',
        { class: 'friends-note' },
        'Go home whenever you like. Anything you picked up here stays here.',
      ),
      h('div', { class: 'dialog-actions' }, goHome),
    );
  };

  const visitAFriend = () => {
    const input = h('input', {
      id: 'visit-code',
      name: 'code',
      autocomplete: 'off',
      autocapitalize: 'characters',
      spellcheck: 'false',
      maxlength: '8',
      required: true,
    });
    const error = h('p', { class: 'form-error', role: 'alert' });
    const go = h('button', { type: 'submit', class: 'primary' }, 'Go');
    const form = h(
      'form',
      {
        class: 'friends-section',
        'aria-labelledby': 'friends-visit',
        novalidate: true,
        onsubmit: (event: Event) => {
          event.preventDefault();
          void submit();
        },
      },
      h('h3', { id: 'friends-visit' }, 'Visit a friend'),
      h('label', { class: 'field', for: input.id }, h('span', {}, 'Their code'), input),
      error,
      h('div', { class: 'dialog-actions' }, go),
    );
    async function submit() {
      error.textContent = '';
      go.disabled = true;
      try {
        const world = await redeemCode(input.value);
        dialog.close();
        onVisit(world);
      } catch (e) {
        error.textContent = e instanceof Error ? e.message : 'Something went wrong';
      } finally {
        go.disabled = false;
      }
    }
    return form;
  };

  const open = () => {
    const yours = visiting ? awayFromHome() : yoursLoading();
    dialog.replaceChildren(
      h(
        'div',
        { class: 'friends-body' },
        h('h2', { id: 'friends-title' }, 'Play with friends'),
        yours,
        visitAFriend(),
        h(
          'div',
          { class: 'dialog-actions' },
          h('button', { type: 'button', class: 'link', onclick: () => dialog.close() }, 'Done'),
        ),
      ),
    );
    dialog.showModal();
    if (!visiting) {
      void fetchVisitors(home).then(
        ({ code }) => yours.replaceWith(yourWorld(code)),
        (e: unknown) =>
          yours.replaceWith(
            h(
              'p',
              { class: 'form-error', role: 'alert' },
              e instanceof Error ? e.message : 'Something went wrong',
            ),
          ),
      );
    }
  };

  return h(
    'div',
    {},
    h(
      'button',
      { type: 'button', class: 'link', 'aria-haspopup': 'dialog', onclick: open },
      'Friends',
    ),
    dialog,
  );
}
