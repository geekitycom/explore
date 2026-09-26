import {
  SCREEN_PX_H,
  SCREEN_PX_W,
  TILE,
  inScreen,
  type Avatar,
  type Place,
  type Pose,
  type Screen,
  type Tile,
} from '@explore/core';
import type { User } from '../api.ts';
import { avatarSheet, walkFrameRect } from '../art/avatars.ts';
import type { Art } from '../art/load.ts';
import { buildScene, drawScene, type Scene } from '../art/scene.ts';
import { bakeTerrain } from '../art/terrain.ts';
import type { Renderer } from './game.ts';
import { namePoint } from '../ui/bubbles.ts';
import type { Aim } from './hands.ts';
import type { GameState } from './state.ts';

const FRAME_MS = 140;
/** Ambient motion runs on wall-clock time so players on one screen see it roughly in step. */
const AMBIENT_EPOCH_MS = Date.UTC(2026, 0, 1);
/** The sprite's feet sit this far above its bottom edge. */
const SPRITE_FOOT = 2;
/** Trace looks may change with time; scenes redraw them this often. */
const LOOK_MS = 60_000;
/** Mirror --ink, --paper, --focus and --accent in style.css. */
const INK = '#141b1b';
const PAPER = '#fff4dd';
const FOCUS = '#3aa3c9';
const ACCENT = '#d14b34';

type Actor = { avatar: Avatar; name: string; x: number; y: number; pose: Pose };

/** Mirror .game-canvas's border in style.css. */
const BORDER = 3;

/**
 * Draws the game at the largest integer scale at which it, and `belowPx` rows of frame under it,
 * fit `bounds`. Publishes that scale to CSS as `--scale` on `bounds`.
 */
export function canvasRenderer(
  canvas: HTMLCanvasElement,
  bounds: HTMLElement,
  art: Art,
  belowPx: number,
): Renderer {
  const ctx = canvas.getContext('2d')!;
  const terrains = new WeakMap<Screen, HTMLCanvasElement>();
  const scenes = new WeakMap<Place, { scene: Scene; period: number }>();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let scale = 1;

  const fit = () => {
    const box = bounds.getBoundingClientRect();
    const room = { w: box.width - 2 * BORDER, h: box.height - 3 * BORDER };
    scale = Math.max(
      1,
      Math.floor(Math.min(room.w / SCREEN_PX_W, room.h / (SCREEN_PX_H + belowPx))),
    );
    canvas.width = SCREEN_PX_W * scale;
    canvas.height = SCREEN_PX_H * scale;
    bounds.style.setProperty('--scale', String(scale));
  };
  const observer = new ResizeObserver(fit);
  observer.observe(bounds);
  fit();

  const terrainFor = (screen: Screen) => {
    let terrain = terrains.get(screen);
    if (!terrain) terrains.set(screen, (terrain = bakeTerrain(screen, art)));
    return terrain;
  };

  const sceneFor = (place: Place, now: number): Scene => {
    const period = Math.floor(now / LOOK_MS);
    let entry = scenes.get(place);
    if (entry?.period !== period) {
      entry = { scene: buildScene(place, art, now, terrainFor(place.screen)), period };
      scenes.set(place, entry);
    }
    return entry.scene;
  };

  const drawActor = ({ avatar, x, y, pose }: Actor, clock: number) => {
    const frame = pose.moving ? Math.floor(clock / FRAME_MS) : 0;
    const src = walkFrameRect(pose.dir, frame);
    ctx.drawImage(
      avatarSheet(avatar, art),
      src.x,
      src.y,
      src.w,
      src.h,
      Math.round(x - TILE / 2),
      Math.round(y + SPRITE_FOOT - TILE),
      TILE,
      TILE,
    );
  };

  /** Outlined text centred above the screen point (x, y), as over a player's head. */
  const label = (text: string, x: number, y: number) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const size = Math.max(10, 4 * scale);
    ctx.font = `${size}px 'Pixelify Sans', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = Math.max(2, scale);
    ctx.strokeStyle = INK;
    ctx.fillStyle = PAPER;
    const tx = x * scale;
    const ty = Math.max(y * scale, size + 2);
    ctx.strokeText(text, tx, ty);
    ctx.fillText(text, tx, ty);
    ctx.restore();
  };

  const outline = ({ tile, valid }: Aim) => {
    ctx.lineWidth = 2;
    ctx.strokeStyle = valid ? FOCUS : ACCENT;
    ctx.strokeRect(tile.tx * TILE + 1, tile.ty * TILE + 1, TILE - 2, TILE - 2);
  };

  const message = (text: string) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#141b1b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${6 * scale}px 'Pixelify Sans', monospace`;
    ctx.fillStyle = '#fff4dd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  };

  return {
    draw(state: GameState, you: User, clock: number, aim: Aim | undefined) {
      if (state.phase === 'connecting') {
        message('Connecting…');
        return;
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = false;

      const actors: Actor[] = [
        { avatar: you.avatar, name: you.username, x: state.you.x, y: state.you.y, pose: state.you },
        ...[...state.others.values()].map((p) => ({
          avatar: p.avatar,
          name: p.name,
          x: p.drawX,
          y: p.drawY,
          pose: p,
        })),
      ];
      drawScene(
        ctx,
        sceneFor(state.place, Date.now()),
        art,
        (Date.now() - AMBIENT_EPOCH_MS) / 1000,
        actors.map((a) => ({
          x: a.x,
          y: a.y,
          moving: a.pose.moving,
          sortY: a.y + SPRITE_FOOT,
          draw: () => drawActor(a, clock),
        })),
        !reducedMotion.matches,
      );
      if (aim) outline(aim);
      for (const a of actors) {
        const at = namePoint(a.x, a.y);
        label(a.name, at.x, at.y);
      }

      if (state.phase === 'travelling') {
        ctx.fillStyle = 'rgba(20, 27, 27, 0.35)';
        ctx.fillRect(0, 0, SCREEN_PX_W, SCREEN_PX_H);
      }
    },
    tileAt(event: MouseEvent): Tile | undefined {
      const box = canvas.getBoundingClientRect();
      const x = (event.clientX - box.left - canvas.clientLeft) / scale;
      const y = (event.clientY - box.top - canvas.clientTop) / scale;
      const tile = { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
      return inScreen(tile.tx, tile.ty) ? tile : undefined;
    },
    dispose() {
      observer.disconnect();
    },
  };
}
