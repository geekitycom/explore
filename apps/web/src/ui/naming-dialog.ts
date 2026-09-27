import {
  LANDMARK_NOUNS,
  LINE_MAX,
  NAME_MAX,
  resolve,
  siteOf,
  wordsOf,
  type ClientMessage,
  type Here,
  type Suggestion,
} from '@explore/core';
import { h } from './dom.ts';

/** A dialog for writing a trace's words, opened by an offer or a bubble's Rename button. */
export type Composer = {
  readonly el: HTMLElement;
  open(): void;
  /** A refusal from the server; false when no save was waiting for one. */
  refused(reason: string): boolean;
  /** Each frame: closes once the world shows the save, and keeps untouched fields in step with the world. */
  sync(here: Here): void;
};

type Naming =
  { readonly op: 'name'; readonly name: string; readonly line: string } | { readonly op: 'clear' };

type Named = NonNullable<ReturnType<typeof siteOf>>['named'];

/** Whether the screen's landmark now reads as the save predicted, so the dialog can close. */
export function namingShown(expected: Named, here: Here): boolean {
  const named = siteOf(here)?.named;
  return (
    named?.name === expected?.name &&
    named?.line === expected?.line &&
    named?.by.id === expected?.by.id
  );
}

const counted = (label: string, name: string, max: number, value: string) => {
  const input = h('input', {
    name,
    id: `naming-${name}`,
    maxlength: String(max),
    autocomplete: 'off',
  });
  input.value = value;
  const count = h('span', { class: 'count', 'aria-live': 'polite' });
  const recount = () => {
    count.textContent = `${input.value.length}/${max}`;
  };
  input.addEventListener('input', recount);
  recount();
  return {
    input,
    el: h('label', { class: 'field', for: input.id }, h('span', {}, label), input, count),
  };
};

const REFRESH =
  '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">' +
  '<path d="M13 8a5 5 0 1 1-1.5-3.6" fill="none" stroke="currentColor" stroke-width="2"/>' +
  '<path d="M13 2v4H9" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

type Filled = { readonly name: string; readonly line: string };

const filledFrom = (here: Here): Filled => {
  const site = siteOf(here);
  const shown = site && wordsOf(site);
  return { name: shown?.name ?? '', line: shown?.line ?? '' };
};

/**
 * Renames the landmark the player stands by, or takes a player's name off so the land's shows
 * again. It opens with the words on the post. With a language model on the server, a button
 * fills the fields with a suggested name; only Save changes the post. The dialog stays open until
 * the server shows the save or refuses it, so a player beaten to it keeps what they wrote.
 */
export function namingDialog(
  here: () => Here | undefined,
  send: (message: ClientMessage) => void,
  canSuggest: () => boolean,
) {
  const el = h('dialog', { class: 'naming-dialog', 'aria-labelledby': 'naming-title' });
  // Arrow keys and WASD in the dialog would otherwise also walk the player.
  el.addEventListener('keydown', (event) => event.stopPropagation());
  let waiting: { expected: Named } | undefined;
  let error: HTMLElement | undefined;
  let buttons: HTMLButtonElement[] = [];
  let fields: { name: HTMLInputElement; line: HTMLInputElement } | undefined;
  /** What the fields held when the dialog last took the post's words. */
  let filled: Filled = { name: '', line: '' };
  let suggestButton: HTMLButtonElement | undefined;
  /** The number of the last suggestion asked for; answers to any other are stale. */
  let asked = 0;
  let thinking = false;

  const think = (on: boolean) => {
    thinking = on;
    if (!suggestButton) return;
    suggestButton.disabled = on;
    suggestButton.classList.toggle('busy', on);
    suggestButton.setAttribute('aria-busy', String(on));
  };

  const settle = (reason: string | undefined) => {
    waiting = undefined;
    for (const b of buttons) b.disabled = false;
    if (error) error.textContent = reason ?? '';
  };

  const fill = (words: Filled) => {
    if (!fields) return;
    fields.name.value = words.name;
    fields.line.value = words.line;
    for (const input of [fields.name, fields.line]) input.dispatchEvent(new Event('input'));
  };

  const submit = (naming: Naming) => {
    const now = here();
    if (!now) return;
    const outcome = resolve(now, { verb: 'act', kind: 'landmark', input: naming });
    if (outcome.kind === 'refused') return settle(outcome.reason);
    const put = outcome.kind === 'done' ? outcome.changes.find((c) => 'put' in c) : undefined;
    if (!put || put.put.kind !== 'landmark') return;
    waiting = { expected: put.put.named };
    for (const b of buttons) b.disabled = true;
    if (error) error.textContent = '';
    send({ t: 'act', action: { kind: 'landmark', input: naming } });
  };

  const suggest = () => {
    if (thinking) return;
    think(true);
    if (error) error.textContent = '';
    send({ t: 'suggest', n: ++asked });
  };

  const open = () => {
    const now = here();
    const site = now && siteOf(now);
    if (!site) return;
    const shown = wordsOf(site);
    const noun = LANDMARK_NOUNS[site.poi];
    filled = filledFrom(now);
    const name = counted('Name', 'name', NAME_MAX, filled.name);
    const line = counted('A line for travellers (optional)', 'line', LINE_MAX, filled.line);
    fields = { name: name.input, line: line.input };
    error = h('p', { class: 'form-error', role: 'alert' });
    const save = h('button', { type: 'submit', class: 'primary' }, 'Save');
    const restore = h(
      'button',
      { type: 'button', class: 'link', onclick: () => submit({ op: 'clear' }) },
      "Use the land's name",
    );
    const cancel = h(
      'button',
      { type: 'button', class: 'link', onclick: () => el.close() },
      'Cancel',
    );
    const icon = h('span', { class: 'suggest-icon' });
    icon.innerHTML = REFRESH;
    suggestButton =
      shown && canSuggest()
        ? h(
            'button',
            { type: 'button', class: 'link suggest', onclick: suggest },
            icon,
            'Suggest a name',
          )
        : undefined;
    const tools = [...(suggestButton ? [suggestButton] : []), ...(site.named ? [restore] : [])];
    buttons = site.named ? [restore, save] : [save];
    const credit = !shown
      ? ''
      : site.named
        ? `Named by ${site.named.by.name}. `
        : 'The land gave it this name. ';
    el.replaceChildren(
      h(
        'form',
        {
          class: 'naming-form',
          onsubmit: (event: Event) => {
            event.preventDefault();
            submit({ op: 'name', name: name.input.value, line: line.input.value });
          },
        },
        h('h2', { id: 'naming-title' }, shown ? `Rename this ${noun}` : `Name this ${noun}`),
        h(
          'p',
          { class: 'naming-note' },
          `${credit}A signpost shows the name to everyone who passes, and the map does too.`,
        ),
        name.el,
        line.el,
        ...(tools.length > 0 ? [h('div', { class: 'naming-tools' }, ...tools)] : []),
        error,
        h('div', { class: 'dialog-actions' }, cancel, save),
      ),
    );
    settle(undefined);
    think(false);
    el.showModal();
    name.input.focus();
  };

  el.addEventListener('close', () => {
    settle(undefined);
    think(false);
  });

  return {
    el,
    open,
    refused(reason: string): boolean {
      if (!waiting) return false;
      settle(reason);
      return true;
    },
    sync(now: Here): void {
      if (waiting && namingShown(waiting.expected, now)) return el.close();
      if (!el.open || waiting || !fields) return;
      const current = filledFrom(now);
      if (current.name === filled.name && current.line === filled.line) return;
      const untouched = fields.name.value === filled.name && fields.line.value === filled.line;
      filled = current;
      if (!untouched) return;
      fill(current);
      if (error) error.textContent = 'The signpost just changed. These are its new words.';
    },
    /** The answer to a suggestion; one that was not the last asked for is dropped. */
    suggested(n: number, suggestion: Suggestion): void {
      if (!thinking || n !== asked) return;
      think(false);
      if (suggestion.ok) fill(suggestion);
      else if (error) error.textContent = suggestion.reason;
    },
  } satisfies Composer & { suggested(n: number, suggestion: Suggestion): void };
}
