import {
  LANDMARK_NOUNS,
  LINE_MAX,
  NAME_MAX,
  resolve,
  siteOf,
  type ClientMessage,
  type Here,
} from '@explore/core';
import { h } from './dom.ts';

/** A dialog for writing a trace's words, opened by an offer or a bubble's Edit button. */
export type Composer = {
  readonly el: HTMLElement;
  open(): void;
  /** A refusal from the server; false when no save was waiting for one. */
  refused(reason: string): boolean;
  /** Each frame: closes once the world shows the save. */
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

/**
 * Names the landmark the player stands in, or renames or clears their own. The dialog stays open
 * until the server shows the name or refuses it, so a player beaten to it keeps what they wrote
 * and reads who got there first.
 */
export function namingDialog(here: () => Here | undefined, send: (message: ClientMessage) => void) {
  const el = h('dialog', { class: 'naming-dialog', 'aria-labelledby': 'naming-title' });
  // Arrow keys and WASD in the dialog would otherwise also walk the player.
  el.addEventListener('keydown', (event) => event.stopPropagation());
  let waiting: { expected: Named } | undefined;
  let error: HTMLElement | undefined;
  let buttons: HTMLButtonElement[] = [];

  const settle = (reason: string | undefined) => {
    waiting = undefined;
    for (const b of buttons) b.disabled = false;
    if (error) error.textContent = reason ?? '';
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

  const open = () => {
    const now = here();
    const site = now && siteOf(now);
    if (!site) return;
    const named = site.named;
    const noun = LANDMARK_NOUNS[site.poi];
    const name = counted('Name', 'name', NAME_MAX, named?.name ?? '');
    const line = counted('A line for travellers (optional)', 'line', LINE_MAX, named?.line ?? '');
    error = h('p', { class: 'form-error', role: 'alert' });
    const save = h('button', { type: 'submit', class: 'primary' }, 'Save');
    const clear = h(
      'button',
      { type: 'button', class: 'link', onclick: () => submit({ op: 'clear' }) },
      'Clear the name',
    );
    const cancel = h(
      'button',
      { type: 'button', class: 'link', onclick: () => el.close() },
      'Cancel',
    );
    buttons = named ? [clear, save] : [save];
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
        h('h2', { id: 'naming-title' }, named ? `Rename this ${noun}` : `Name this ${noun}`),
        h(
          'p',
          { class: 'naming-note' },
          'A signpost will show the name to everyone who passes, and the map will too.',
        ),
        name.el,
        line.el,
        error,
        h('div', { class: 'dialog-actions' }, ...(named ? [clear] : []), cancel, save),
      ),
    );
    settle(undefined);
    el.showModal();
    name.input.focus();
  };

  el.addEventListener('close', () => settle(undefined));

  const composer: Composer = {
    el,
    open,
    refused(reason) {
      if (!waiting) return false;
      settle(reason);
      return true;
    },
    sync(now) {
      if (waiting && namingShown(waiting.expected, now)) el.close();
    },
  };
  return composer;
}
