import { loadSound, saveSound, type SoundSettings } from './settings.ts';

export type AudioBuses = { ctx: AudioContext; music: GainNode; effects: GainNode };

/**
 * Owns the AudioContext. Browsers refuse to start audio before the user interacts, so the
 * context is created on the first key press or click, and callbacks wait until then.
 */
export function createAudioEngine() {
  let settings = loadSound();
  let buses: AudioBuses | undefined;
  const waiting: ((b: AudioBuses) => void)[] = [];

  const apply = () => {
    if (!buses) return;
    const now = buses.ctx.currentTime;
    buses.music.gain.setTargetAtTime(settings.muted ? 0 : settings.music, now, 0.05);
    buses.effects.gain.setTargetAtTime(settings.muted ? 0 : settings.effects, now, 0.05);
  };

  const unlock = () => {
    if (buses) return;
    const ctx = new AudioContext();
    const music = ctx.createGain();
    const effects = ctx.createGain();
    music.connect(ctx.destination);
    effects.connect(ctx.destination);
    buses = { ctx, music, effects };
    apply();
    for (const fn of waiting.splice(0)) fn(buses);
    removeEventListener('keydown', unlock);
    removeEventListener('pointerdown', unlock);
  };
  addEventListener('keydown', unlock);
  addEventListener('pointerdown', unlock);

  document.addEventListener('visibilitychange', () => {
    if (!buses) return;
    void (document.hidden ? buses.ctx.suspend() : buses.ctx.resume());
  });

  return {
    settings: () => settings,
    update(next: Partial<SoundSettings>) {
      settings = { ...settings, ...next };
      saveSound(settings);
      apply();
    },
    whenReady(fn: (b: AudioBuses) => void) {
      if (buses) fn(buses);
      else waiting.push(fn);
    },
    /** Call from a user gesture that another handler keeps from reaching the window. */
    unlock,
    state: () => buses?.ctx.state ?? 'locked',
  };
}

export type AudioEngine = ReturnType<typeof createAudioEngine>;
