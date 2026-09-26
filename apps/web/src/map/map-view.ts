import {
  SCREEN_H,
  SCREEN_W,
  decodeScreen,
  layerIdSchema,
  screenKey,
  type Screen,
} from '@explore/core';
import type { WorldMap } from '../api.ts';
import { h } from '../ui/dom.ts';
import { screenPixels } from './colors.ts';

const MIN_SCALE = 1;
const MAX_SCALE = 24;
const PAN_STEP = 40;
/** Mirrors --paper in style.css. */
const PAPER = '#fff4dd';
const INK = '#141b1b';
const YOU = '#e07aa8';
const GARDEN = '#e3c16f';
const LABEL_STROKE = 3;
const font = (size: number) => `${size}px 'Pixelify Sans', monospace`;

type View = { scale: number; cx: number; cy: number };

/** An interactive map of every discovered screen, one pixel per tile at scale 1. */
export function mapView(data: WorldMap, onBack?: () => void) {
  const layer = layerIdSchema.parse(data.layer);
  const screens = data.screens.map((raw) => decodeScreen(raw));
  const tiles = new Map<string, HTMLCanvasElement>();
  for (const screen of screens) tiles.set(screenKey(screen.coord), rasterise(screen));

  const canvas = h('canvas', {
    class: 'map-canvas',
    tabindex: '0',
    'aria-label': `World map with ${screens.length} discovered screens. Drag or use arrow keys to pan, plus and minus to zoom, 0 to return to you.`,
  });
  const readout = h('p', { class: 'map-readout', 'aria-live': 'polite' }, '');
  // The canvas is sized from its container, never from itself, so resizing it cannot feed back.
  const stage = h('div', { class: 'map-stage' }, canvas);
  const ctx = canvas.getContext('2d')!;

  const youX = (data.you.sx + 0.5) * SCREEN_W;
  const youY = (data.you.sy + 0.5) * SCREEN_H;
  let view: View = { scale: 4, cx: youX, cy: youY };
  let fitted = false;

  /** Opens zoomed so the whole discovered world fits, but never so far in that it looks blurry. */
  const fit = () => {
    const xs = screens.map((sc) => sc.coord.sx);
    const ys = screens.map((sc) => sc.coord.sy);
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * SCREEN_W;
    const hgt = (Math.max(...ys) - Math.min(...ys) + 1) * SCREEN_H;
    const box = stage.getBoundingClientRect();
    const scale = Math.min(12, (box.width * 0.8) / w, (box.height * 0.8) / hgt);
    view = {
      scale: Math.max(MIN_SCALE, Math.floor(scale)),
      cx: ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * SCREEN_W,
      cy: ((Math.min(...ys) + Math.max(...ys) + 1) / 2) * SCREEN_H,
    };
  };

  /** Device pixels per world tile pixel; pointer and canvas coordinates are in device pixels. */
  const pxScale = () => view.scale * devicePixelRatio;
  const toWorld = (px: number, py: number) => ({
    x: view.cx + (px - canvas.width / 2) / pxScale(),
    y: view.cy + (py - canvas.height / 2) / pxScale(),
  });

  const draw = () => {
    if (!fitted && screens.length > 0) {
      fit();
      fitted = true;
    }
    const dpr = devicePixelRatio;
    const { width, height } = stage.getBoundingClientRect();
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0f1515';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const s = view.scale * dpr;
    const ox = canvas.width / 2 - view.cx * s;
    const oy = canvas.height / 2 - view.cy * s;
    ctx.imageSmoothingEnabled = false;
    const sx0 = Math.floor(-ox / s / SCREEN_W) - 1;
    const sy0 = Math.floor(-oy / s / SCREEN_H) - 1;
    const sx1 = Math.ceil((canvas.width - ox) / s / SCREEN_W);
    const sy1 = Math.ceil((canvas.height - oy) / s / SCREEN_H);
    for (let sy = sy0; sy <= sy1; sy++) {
      for (let sx = sx0; sx <= sx1; sx++) {
        const tile = tiles.get(screenKey({ layer, sx, sy }));
        if (!tile) continue;
        const { x, y, w, h } = screenRect(s, ox, oy, sx, sy);
        ctx.drawImage(tile, x, y, w, h);
      }
    }

    if (view.scale >= 6) {
      ctx.strokeStyle = 'rgba(15, 21, 21, 0.35)';
      ctx.lineWidth = 1;
      for (const screen of screens) {
        const { x, y, w, h } = screenRect(s, ox, oy, screen.coord.sx, screen.coord.sy);
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      }
    }

    const frame = (sx: number, sy: number, color: string) => {
      const { x, y, w, h: hgt } = screenRect(s, ox, oy, sx, sy);
      const pad = 2 * dpr;
      ctx.lineWidth = 4 * dpr;
      ctx.strokeStyle = INK;
      ctx.strokeRect(x - pad, y - pad, w + 2 * pad, hgt + 2 * pad);
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = color;
      ctx.strokeRect(x - pad, y - pad, w + 2 * pad, hgt + 2 * pad);
    };
    for (const { x, y } of data.names) {
      const px = ox + x * s;
      const py = oy + y * s;
      ctx.fillStyle = INK;
      ctx.fillRect(px - 2.5 * dpr, py - 2.5 * dpr, 5 * dpr, 5 * dpr);
      ctx.fillStyle = PAPER;
      ctx.fillRect(px - 1.5 * dpr, py - 1.5 * dpr, 3 * dpr, 3 * dpr);
    }
    if (data.garden) frame(data.garden.sx, data.garden.sy, GARDEN);
    frame(data.you.sx, data.you.sy, YOU);

    const measure = (text: string, size: number) => {
      ctx.font = font(size);
      return ctx.measureText(text).width;
    };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = LABEL_STROKE * dpr;
    ctx.strokeStyle = INK;
    for (const label of mapLabels(data, s, ox, oy, dpr, measure)) {
      ctx.font = font(label.size);
      ctx.fillStyle = label.color;
      const cx = label.x + label.w / 2;
      const bottom = label.y + label.h - (LABEL_STROKE * dpr) / 2;
      ctx.strokeText(label.text, cx, bottom);
      ctx.fillText(label.text, cx, bottom);
    }
  };

  const zoomAt = (factor: number, px = canvas.width / 2, py = canvas.height / 2) => {
    const before = toWorld(px, py);
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
    view = {
      scale,
      cx: before.x - (px - canvas.width / 2) / (scale * devicePixelRatio),
      cy: before.y - (py - canvas.height / 2) / (scale * devicePixelRatio),
    };
    draw();
  };
  const pan = (dx: number, dy: number) => {
    view = { ...view, cx: view.cx + dx / pxScale(), cy: view.cy + dy / pxScale() };
    draw();
  };

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    zoomAt(
      e.deltaY < 0 ? 1.25 : 0.8,
      (e.clientX - r.left) * devicePixelRatio,
      (e.clientY - r.top) * devicePixelRatio,
    );
  });
  let drag: { x: number; y: number } | undefined;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', () => (drag = undefined));
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const w = toWorld(
      (e.clientX - r.left) * devicePixelRatio,
      (e.clientY - r.top) * devicePixelRatio,
    );
    const sx = Math.floor(w.x / SCREEN_W);
    const sy = Math.floor(w.y / SCREEN_H);
    const known = tiles.has(screenKey({ layer, sx, sy }));
    readout.textContent = `Screen ${sx}, ${sy}${known ? '' : ' (undiscovered)'}`;
    if (!drag) return;
    pan((drag.x - e.clientX) * devicePixelRatio, (drag.y - e.clientY) * devicePixelRatio);
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('keydown', (e) => {
    const step = PAN_STEP * devicePixelRatio;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => pan(-step, 0),
      ArrowRight: () => pan(step, 0),
      ArrowUp: () => pan(0, -step),
      ArrowDown: () => pan(0, step),
      '+': () => zoomAt(1.25),
      '=': () => zoomAt(1.25),
      '-': () => zoomAt(0.8),
      '0': () => {
        view = { ...view, cx: youX, cy: youY };
        draw();
      },
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  });
  const observer = new ResizeObserver(draw);

  const el = h(
    'main',
    { class: 'map' },
    h(
      'header',
      { class: 'game-bar' },
      h('span', { class: 'who' }, 'World map'),
      h('p', { class: 'status' }, `${screens.length} screens discovered`),
      h(
        'a',
        {
          class: 'link',
          href: '/',
          onclick: (e) => {
            if (!onBack) return;
            e.preventDefault();
            onBack();
          },
        },
        'Back to the game',
      ),
    ),
    stage,
    readout,
  );

  return {
    el,
    mount() {
      observer.observe(stage);
      draw();
      canvas.focus();
    },
    dispose: () => observer.disconnect(),
    /** Test hook: the world-pixel scale, which screens were drawn, and the names on them. */
    state: () => ({ ...view, screens: screens.map((s) => s.coord), names: data.names }),
  };
}

/**
 * Where a screen lands on the canvas, in device pixels. Each edge is rounded on its own so
 * neighbours share it exactly: a fractional edge is antialiased and lets the background show
 * through as a line between screens.
 */
export function screenRect(scale: number, ox: number, oy: number, sx: number, sy: number) {
  const x = Math.round(ox + sx * SCREEN_W * scale);
  const y = Math.round(oy + sy * SCREEN_H * scale);
  return {
    x,
    y,
    w: Math.round(ox + (sx + 1) * SCREEN_W * scale) - x,
    h: Math.round(oy + (sy + 1) * SCREEN_H * scale) - y,
  };
}

export type MapLabel = {
  text: string;
  color: string;
  /** Font size in device pixels. */
  size: number;
  /** The label's box on the canvas in device pixels, outline included. */
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Where each map label goes. Labels claim their spot in order (You, the garden, then landmark
 * names), and one that would touch a label already placed rises above it.
 */
export function mapLabels(
  data: Pick<WorldMap, 'you' | 'garden' | 'names'>,
  scale: number,
  ox: number,
  oy: number,
  dpr: number,
  measure: (text: string, size: number) => number,
): MapLabel[] {
  const aboveScreen = ({ sx, sy }: { sx: number; sy: number }) => {
    const r = screenRect(scale, ox, oy, sx, sy);
    return { cx: r.x + r.w / 2, bottom: r.y - 5 * dpr };
  };
  const wanted = [
    { text: 'You', color: YOU, size: 12 * dpr, ...aboveScreen(data.you) },
    ...(data.garden
      ? [{ text: 'Garden', color: GARDEN, size: 12 * dpr, ...aboveScreen(data.garden) }]
      : []),
    ...data.names.map(({ x, y, name }) => ({
      text: name,
      color: PAPER,
      size: 11 * dpr,
      cx: ox + x * scale,
      bottom: oy + y * scale - 4 * dpr,
    })),
  ];
  const stroke = LABEL_STROKE * dpr;
  const gap = Math.round(dpr);
  const placed: MapLabel[] = [];
  for (const { text, color, size, cx, bottom } of wanted) {
    const w = Math.ceil(measure(text, size) + stroke);
    const h = Math.ceil(size + stroke);
    const label = {
      text,
      color,
      size,
      x: Math.round(cx - w / 2),
      y: Math.round(bottom + stroke / 2 - h),
      w,
      h,
    };
    // Rising past a label means never meeting it again, so this ends within placed.length steps.
    for (let hit = placed.find((p) => overlaps(p, label, gap)); hit;) {
      label.y = hit.y - gap - h;
      hit = placed.find((p) => overlaps(p, label, gap));
    }
    placed.push(label);
  }
  return placed;
}

const overlaps = (a: MapLabel, b: MapLabel, gap: number) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

function rasterise(screen: Screen): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SCREEN_W;
  c.height = SCREEN_H;
  c.getContext('2d')!.putImageData(new ImageData(screenPixels(screen), SCREEN_W, SCREEN_H), 0, 0);
  return c;
}
