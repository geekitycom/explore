export type SoundSettings = { muted: boolean; music: number; effects: number };

export const DEFAULT_SOUND: SoundSettings = { muted: false, music: 0.5, effects: 0.7 };

const KEY = 'explore.sound';

const unit = (v: unknown, fallback: number) =>
  typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback;

export function loadSound(): SoundSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<
      Record<keyof SoundSettings, unknown>
    >;
    return {
      muted: typeof raw.muted === 'boolean' ? raw.muted : DEFAULT_SOUND.muted,
      music: unit(raw.music, DEFAULT_SOUND.music),
      effects: unit(raw.effects, DEFAULT_SOUND.effects),
    };
  } catch {
    return DEFAULT_SOUND;
  }
}

export function saveSound(settings: SoundSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable (private mode); settings then last for this page only.
  }
}
