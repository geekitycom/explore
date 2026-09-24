import { z } from 'zod';

export const SKIN_TONES = {
  porcelain: '#f6d7c3',
  peach: '#eab08c',
  tan: '#c68a5e',
  bronze: '#9a6440',
  umber: '#6b4128',
  ebony: '#452a1a',
} as const;

export const HAIR_COLORS = {
  black: '#2a2023',
  brown: '#6b3e26',
  auburn: '#9c3d23',
  blonde: '#e3c16f',
  silver: '#c9c9d4',
  teal: '#3aa39a',
  pink: '#e07aa8',
} as const;

export const CLOTH_COLORS = {
  red: '#c0392b',
  orange: '#e67e22',
  yellow: '#f1c40f',
  green: '#3d9b4f',
  blue: '#2e6fbf',
  purple: '#7d4ea3',
  white: '#e8e8e8',
  charcoal: '#3b3b44',
} as const;

export const HAIR_STYLES = ['short', 'long', 'spiky', 'bun'] as const;

const keyOf = <T extends Record<string, string>>(palette: T) =>
  z.enum(Object.keys(palette) as [keyof T & string, ...(keyof T & string)[]]);

export const avatarSchema = z.object({
  skin: keyOf(SKIN_TONES),
  hairStyle: z.enum(HAIR_STYLES),
  hairColor: keyOf(HAIR_COLORS),
  shirt: keyOf(CLOTH_COLORS),
  pants: keyOf(CLOTH_COLORS),
});

export type Avatar = z.infer<typeof avatarSchema>;

export const DEFAULT_AVATAR: Avatar = {
  skin: 'peach',
  hairStyle: 'short',
  hairColor: 'brown',
  shirt: 'green',
  pants: 'blue',
};
