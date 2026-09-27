import type { Biome } from '@explore/core';

/** How a prompt names the land a place lies in. */
export const LANDS: Readonly<Record<Biome, string>> = {
  garden: 'a walled garden',
  meadow: 'the meadows',
  forest: 'a deep forest',
  lakeland: 'the lake country',
  scrubland: 'dry scrubland',
  desert: 'the desert',
  highlands: 'the windy highlands',
  taiga: 'the northern pine woods',
  tundra: 'the frozen tundra',
};

const BLOCKED =
  /\b(fuck\w*|shit\w*|cunt\w*|bitch\w*|bastard\w*|whore\w*|slut\w*|nigg\w*|fag\w*|retard\w*|rape\w*|nazi\w*|kill yourself|as an ai|language model|i cannot|i can't)\b/i;

/**
 * One line of a model's reply as words players read: a leading `label`, quotes and markdown
 * removed, whitespace folded. Undefined when shorter than 3 or longer than `max`, or when it holds
 * control characters, markup, or something the game should not say.
 */
export function cleanLine(raw: string, max: number, label: RegExp): string | undefined {
  const text = raw
    .trim()
    .replace(label, '')
    .replace(/["“”«»*_`]/g, '')
    .replace(/^['‘’]+|['‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 3 || text.length > max) return undefined;
  if (/[\p{C}<>]/u.test(text) || BLOCKED.test(text)) return undefined;
  return text;
}

/** The reply's lines, trimmed, with the blank ones dropped. */
export const linesOf = (raw: string): string[] =>
  raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
