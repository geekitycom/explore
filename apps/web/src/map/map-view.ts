import {
  CLOTH_COLORS,
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

/** CSS pixels per world tile: 120x90 per screen, however much is discovered. */
const TILE_CSS = 6;
/** Mirrors --paper in style.css. */
const PAPER = '#fff4dd';
const INK = '#141b1b';
const LABEL_STROKE = 3;
/** Outer sizes, in CSS pixels, of a player's dot and a landmark's marker, both outlined in ink. */
const DOT = 8;
const MARK = 5;
const font = (size: number) => `${size}px 'Pixelify Sans', monospace`;

/**
 * Where the world lands on a canvas of the given device-pixel size: the player's screen in the
 * centre, a whole number of device pixels per tile so every tile stays crisp, origin on a whole
 * pixel. The map never pans or zooms, so a player sees only what surrounds them.
 */
export function mapLayout(
  you: Pick<WorldMap['you'], 'sx' | 'sy'>,
  dpr: number,
  width: number,
  height: number,
) {
  const s = Math.max(1, Math.round(TILE_CSS * dpr));
  return {
    s,
    ox: Math.round(width / 2 - (you.sx + 0.5) * SCREEN_W * s),
    oy: Math.round(height / 2 - (you.sy + 0.5) * SCREEN_H * s),
  };
}

/** A map of the discovered screens around the player's own screen. */
export function mapView(data: WorldMap, onBack?: () => void) {
  const layer = layerIdSchema.parse(data.layer);
  const screens = data.screens.map((raw) => decodeScreen(raw));
  const tiles = new Map<string, HTMLCanvasElement>();
  for (const screen of screens) tiles.set(screenKey(screen.coord), rasterise(screen));

  const canvas = h('canvas', {
    class: 'map-canvas',
    role: 'img',
    'aria-label': `World map with ${screens.length} discovered screens and ${data.players.length} players, centred on your screen.`,
  });
  const readout = h('p', { class: 'map-readout', 'aria-live': 'polite' }, '');
  // The canvas is sized from its container, never from itself, so resizing it cannot feed back.
  const stage = h('div', { class: 'map-stage' }, canvas);
  const ctx = canvas.getContext('2d')!;

  let drawn = 0;

  const layout = () => mapLayout(data.you, devicePixelRatio, canvas.width, canvas.height);
  const toWorld = (px: number, py: number) => {
    const { s, ox, oy } = layout();
    return { x: (px - ox) / s, y: (py - oy) / s };
  };

  const draw = () => {
    const dpr = devicePixelRatio;
    const { width, height } = stage.getBoundingClientRect();
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0f1515';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const { s, ox, oy } = layout();
    ctx.imageSmoothingEnabled = false;
    const sx0 = Math.floor(-ox / s / SCREEN_W) - 1;
    const sy0 = Math.floor(-oy / s / SCREEN_H) - 1;
    const sx1 = Math.ceil((canvas.width - ox) / s / SCREEN_W);
    const sy1 = Math.ceil((canvas.height - oy) / s / SCREEN_H);
    drawn = 0;
    for (let sy = sy0; sy <= sy1; sy++) {
      for (let sx = sx0; sx <= sx1; sx++) {
        const tile = tiles.get(screenKey({ layer, sx, sy }));
        if (!tile) continue;
        const { x, y, w, h } = screenRect(s, ox, oy, sx, sy);
        ctx.drawImage(tile, x, y, w, h);
        if (x < canvas.width && y < canvas.height && x + w > 0 && y + h > 0) drawn++;
      }
    }

    const square = (x: number, y: number, size: number, fill: string) => {
      const px = ox + x * s;
      const py = oy + y * s;
      ctx.fillStyle = INK;
      ctx.fillRect(px - (size / 2) * dpr, py - (size / 2) * dpr, size * dpr, size * dpr);
      const inner = size - 3;
      ctx.fillStyle = fill;
      ctx.fillRect(px - (inner / 2) * dpr, py - (inner / 2) * dpr, inner * dpr, inner * dpr);
    };
    for (const { x, y } of landmarks(data)) square(x, y, MARK, PAPER);
    for (const { x, y, shirt } of data.players) square(x, y, DOT, CLOTH_COLORS[shirt]);

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
    },
    dispose: () => observer.disconnect(),
    /**
     * Test hook: device pixels per tile, where the player's screen sits on the canvas,
     * how many discovered screens are in sight, every discovered screen, and the names on them.
     */
    state: () => {
      const { s, ox, oy } = layout();
      return {
        tilePixels: s,
        canvas: { w: canvas.width, h: canvas.height },
        you: screenRect(s, ox, oy, data.you.sx, data.you.sy),
        drawn,
        screens: screens.map((sc) => sc.coord),
        names: data.names,
        players: data.players,
      };
    },
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

/** The garden is marked like any landmark, at its screen's centre tile. */
function landmarks(data: Pick<WorldMap, 'garden' | 'names'>) {
  const garden = data.garden && {
    x: data.garden.sx * SCREEN_W + Math.floor(SCREEN_W / 2) + 0.5,
    y: data.garden.sy * SCREEN_H + Math.floor(SCREEN_H / 2) + 0.5,
    name: 'Secret Garden',
  };
  return garden ? [garden, ...data.names] : data.names;
}

/**
 * Where each map label goes. Labels claim their spot in order (players by display name, the
 * garden, then landmark names), and one that would touch a label already placed, a player's dot,
 * or a landmark's marker rises above it.
 */
export function mapLabels(
  data: Pick<WorldMap, 'garden' | 'names' | 'players'>,
  scale: number,
  ox: number,
  oy: number,
  dpr: number,
  measure: (text: string, size: number) => number,
): MapLabel[] {
  const wanted = [
    ...data.players.map(({ x, y, name }) => ({
      text: name,
      color: PAPER,
      size: 11 * dpr,
      cx: ox + x * scale,
      bottom: oy + y * scale - 6 * dpr,
      below: oy + y * scale + (DOT / 2 + 2) * dpr,
    })),
    ...landmarks(data).map(({ x, y, name }) => ({
      text: name,
      color: PAPER,
      size: 11 * dpr,
      cx: ox + x * scale,
      bottom: oy + y * scale - 4 * dpr,
      below: undefined,
    })),
  ];
  const square = (x: number, y: number, size: number): Box => ({
    x: ox + x * scale - (size / 2) * dpr,
    y: oy + y * scale - (size / 2) * dpr,
    w: size * dpr,
    h: size * dpr,
  });
  const marks = [
    ...data.players.map(({ x, y }) => square(x, y, DOT)),
    ...landmarks(data).map(({ x, y }) => square(x, y, MARK)),
  ];
  const stroke = LABEL_STROKE * dpr;
  const gap = Math.round(dpr);
  const placed: MapLabel[] = [];
  const hits = (label: MapLabel) => [...marks, ...placed].find((p) => overlaps(p, label, gap));
  for (const { text, color, size, cx, bottom, below } of wanted) {
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
    // A player's name keeps beside its dot when it can, so crowded players stay told apart.
    if (hits(label) && below !== undefined) {
      const under = { ...label, y: Math.ceil(below) };
      if (!hits(under)) label.y = under.y;
    }
    // Rising past a box means never meeting it again, so this ends within one step per box.
    for (let hit = hits(label); hit; hit = hits(label)) label.y = Math.floor(hit.y) - gap - h;
    placed.push(label);
  }
  return placed;
}

type Box = { x: number; y: number; w: number; h: number };

const overlaps = (a: Box, b: Box, gap: number) =>
  a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

function rasterise(screen: Screen): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SCREEN_W;
  c.height = SCREEN_H;
  c.getContext('2d')!.putImageData(new ImageData(screenPixels(screen), SCREEN_W, SCREEN_H), 0, 0);
  return c;
}
