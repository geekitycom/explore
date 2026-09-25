import { SCREEN_PX_H, SCREEN_PX_W, TILE, type Avatar, type Pose, type Screen } from '@explore/core';
import type { User } from '../api.ts';
import { avatarSheet, walkFrameRect } from '../art/avatars.ts';
import type { Art } from '../art/load.ts';
import { buildScene, drawScene, type Scene } from '../art/scene.ts';
import type { Renderer } from './game.ts';
import type { GameState } from './state.ts';

const FRAME_MS = 140;
/** Ambient motion runs on wall-clock time so players on one screen see it roughly in step. */
const AMBIENT_EPOCH_MS = Date.UTC(2026, 0, 1);
/** The sprite's feet sit this far above its bottom edge. */
const SPRITE_FOOT = 2;

type Actor = { avatar: Avatar; name: string; x: number; y: number; pose: Pose };

/** Draws the game at the largest integer scale that fits the canvas's container. */
export function canvasRenderer(canvas: HTMLCanvasElement, art: Art): Renderer {
  const ctx = canvas.getContext('2d')!;
  const scenes = new WeakMap<Screen, Scene>();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let scale = 1;

  const fit = () => {
    const box = canvas.parentElement!.getBoundingClientRect();
    scale = Math.max(1, Math.floor(Math.min(box.width / SCREEN_PX_W, box.height / SCREEN_PX_H)));
    canvas.width = SCREEN_PX_W * scale;
    canvas.height = SCREEN_PX_H * scale;
  };
  const observer = new ResizeObserver(fit);
  observer.observe(canvas.parentElement!);
  fit();

  const sceneFor = (screen: Screen): Scene => {
    let scene = scenes.get(screen);
    if (!scene) {
      scene = buildScene(screen, art);
      scenes.set(screen, scene);
    }
    return scene;
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

  const drawName = ({ name, x, y }: Actor) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const size = Math.max(10, 4 * scale);
    ctx.font = `${size}px 'Pixelify Sans', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = Math.max(2, scale);
    ctx.strokeStyle = '#141b1b';
    ctx.fillStyle = '#fff4dd';
    const tx = x * scale;
    const ty = Math.max((y - TILE) * scale, size + 2);
    ctx.strokeText(name, tx, ty);
    ctx.fillText(name, tx, ty);
    ctx.restore();
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
    draw(state: GameState, you: User, clock: number) {
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
        sceneFor(state.screen),
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
      for (const a of actors) drawName(a);

      if (state.phase === 'travelling') {
        ctx.fillStyle = 'rgba(20, 27, 27, 0.35)';
        ctx.fillRect(0, 0, SCREEN_PX_W, SCREEN_PX_H);
      }
    },
    dispose() {
      observer.disconnect();
    },
  };
}
