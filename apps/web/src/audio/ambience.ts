import type { Screen, Terrain } from '@explore/core';
import type { AudioBuses, AudioEngine } from './engine.ts';

/** Every ambient loop, by path under public/assets/ninja-adventure. */
export const AMBIENT_SOUNDS = {
  wind: 'Audio/Sounds/Ambient/Wind2.wav',
  river: 'Audio/Sounds/Ambient/River.wav',
  waves: 'Audio/Sounds/Ambient/Wave.wav',
} as const;

export type AmbientLayer = keyof typeof AMBIENT_SOUNDS;

/** How loud each layer should be, from 0 (silent) to 1 (full). */
export type AmbientMix = Readonly<Record<AmbientLayer, number>>;

const LAYERS = Object.keys(AMBIENT_SOUNDS) as AmbientLayer[];

const SILENCE: AmbientMix = { wind: 0, river: 0, waves: 0 };

/** The recordings differ in loudness; these bring them level with each other, under the music. */
const LOUDNESS: Readonly<Record<AmbientLayer, number>> = { wind: 0.75, river: 3, waves: 3 };

const FADE_S = 1.5;

/** Water covering this share of a screen reads as a lake with waves rather than a stream. */
const LAKE_SHARE = 0.25;

/** How much wind open ground of each terrain carries. */
const WIND: Partial<Record<Terrain, number>> = { water: 0, sand: 0.8, dirt: 0.6, grass: 1 };

/** Terrains added after this table still sit outdoors, so they get some wind. */
const UNLISTED_WIND = 0.5;

const share = <T>(items: readonly T[], match: (item: T) => boolean) =>
  items.filter(match).length / items.length;

export function ambientMix({ corners, features }: Screen): AmbientMix {
  const water = share(corners, (t) => t === 'water');
  const open = corners.reduce((sum, t) => sum + (WIND[t] ?? UNLISTED_WIND), 0) / corners.length;
  const cover = share(features, (f) => f === 'tree' || f === 'bush');
  const wet = water === 0 ? 0 : Math.min(1, 0.4 + water * 2);
  return {
    wind: open * Math.max(0, 1 - cover * 3),
    river: water < LAKE_SHARE ? wet : 0,
    waves: water >= LAKE_SHARE ? wet : 0,
  };
}

const soundUrl = (layer: AmbientLayer) =>
  `${import.meta.env.BASE_URL}assets/ninja-adventure/${AMBIENT_SOUNDS[layer]}`;

/**
 * Loops each ambient layer into the effects bus, so mute and the effects volume apply. A layer
 * loads the first time a screen wants it, then fades toward each new screen's mix.
 */
export function createAmbience(engine: AudioEngine) {
  let wanted = SILENCE;
  const gains = new Map<AmbientLayer, GainNode>();
  const loading = new Set<AmbientLayer>();

  const load = async ({ ctx, effects }: AudioBuses, layer: AmbientLayer) => {
    loading.add(layer);
    try {
      const response = await fetch(soundUrl(layer));
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      const out = ctx.createGain();
      out.gain.value = 0;
      out.connect(effects);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(out);
      source.start();
      gains.set(layer, out);
    } catch {
      // A failed download leaves the layer silent; the next screen that wants it tries again.
    } finally {
      loading.delete(layer);
    }
    fade(ctx);
  };

  const fade = (ctx: AudioContext) => {
    for (const layer of LAYERS) {
      gains
        .get(layer)
        ?.gain.setTargetAtTime(wanted[layer] * LOUDNESS[layer], ctx.currentTime, FADE_S / 3);
    }
  };

  const set = (mix: AmbientMix) => {
    wanted = mix;
    engine.whenReady((buses) => {
      if (wanted !== mix) return;
      for (const layer of LAYERS) {
        if (mix[layer] > 0 && !gains.has(layer) && !loading.has(layer)) void load(buses, layer);
      }
      fade(buses.ctx);
    });
  };

  return {
    set,
    mix: () => wanted,
    loaded: () => LAYERS.filter((layer) => gains.has(layer)),
    stop: () => set(SILENCE),
  };
}
