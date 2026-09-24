import {
  CLOTH_COLORS,
  DIRS,
  HAIR_COLORS,
  HAIR_STYLES,
  SKIN_TONES,
  type Avatar,
  type Dir,
} from '@explore/core';
import { h } from './dom.ts';

export type DrawAvatar = (
  ctx: CanvasRenderingContext2D,
  avatar: Avatar,
  dir: Dir,
  frame: number,
) => void;

type Choice<K extends keyof Avatar> = {
  key: K;
  label: string;
  options: readonly Avatar[K][];
  swatch?: (value: Avatar[K]) => string;
};

const keys = <T extends Record<string, string>>(palette: T) => Object.keys(palette) as (keyof T)[];

const CHOICES = [
  { key: 'hairStyle', label: 'Hair', options: HAIR_STYLES },
  {
    key: 'hairColor',
    label: 'Hair color',
    options: keys(HAIR_COLORS),
    swatch: (v) => HAIR_COLORS[v],
  },
  { key: 'skin', label: 'Skin', options: keys(SKIN_TONES), swatch: (v) => SKIN_TONES[v] },
  { key: 'shirt', label: 'Shirt', options: keys(CLOTH_COLORS), swatch: (v) => CLOTH_COLORS[v] },
  { key: 'pants', label: 'Pants', options: keys(CLOTH_COLORS), swatch: (v) => CLOTH_COLORS[v] },
] satisfies [
  Choice<'hairStyle'>,
  Choice<'hairColor'>,
  Choice<'skin'>,
  Choice<'shirt'>,
  Choice<'pants'>,
];

const PREVIEW_SCALE = 5;

/** A live avatar editor. The preview walks in a circle through all four directions. */
export function avatarPicker(initial: Avatar, draw: DrawAvatar) {
  let avatar = { ...initial };
  const canvas = h('canvas', {
    class: 'avatar-preview',
    width: String(16 * PREVIEW_SCALE),
    height: String(16 * PREVIEW_SCALE),
  });
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const rows = CHOICES.map((choice) => {
    const buttons = (choice.options as readonly string[]).map((value) => {
      const swatch =
        'swatch' in choice ? (choice.swatch as (v: string) => string)(value) : undefined;
      const button = h(
        'button',
        {
          type: 'button',
          class: swatch ? 'swatch' : 'chip',
          title: value,
          'aria-label': `${choice.label}: ${value}`,
          onclick: () => {
            avatar = { ...avatar, [choice.key]: value };
            sync();
          },
        },
        swatch ? '' : value,
      );
      if (swatch) button.style.setProperty('--swatch', swatch);
      return { button, value };
    });
    return {
      choice,
      buttons,
      el: h(
        'div',
        { class: 'choice' },
        h('span', {}, choice.label),
        h('div', { class: 'options' }, ...buttons.map((b) => b.button)),
      ),
    };
  });

  let frame = 0;
  function drawFrame() {
    const dir = DIRS[Math.floor(frame / 8) % DIRS.length]!;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(PREVIEW_SCALE, PREVIEW_SCALE);
    draw(ctx, avatar, dir, frame % 4);
    ctx.restore();
  }

  function sync() {
    for (const { choice, buttons } of rows) {
      for (const { button, value } of buttons) {
        button.setAttribute('aria-pressed', String(avatar[choice.key] === value));
      }
    }
    drawFrame();
  }
  sync();

  const timer = window.setInterval(() => {
    frame++;
    drawFrame();
  }, 150);

  return {
    el: h(
      'div',
      { class: 'avatar-picker' },
      canvas,
      h('div', { class: 'choices' }, ...rows.map((r) => r.el)),
    ),
    value: () => avatar,
    dispose: () => window.clearInterval(timer),
  };
}
