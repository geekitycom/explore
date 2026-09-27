import {
  FENCES,
  LANDMARK_NOUNS,
  LINE_MAX,
  NAME_MAX,
  wordsOf,
  type Site,
  type Suggestion,
  type Biome,
  type Feature,
  type Screen,
  type Terrain,
  type TraceNamed,
} from '@explore/core';
import { LANDS, cleanLine, linesOf } from './game-text.ts';
import { SUGGEST_LIMITS, createRateLimiter, type RateLimiter } from './rate-limit.ts';
import type { TextRequest, TextResult } from './text-gen.ts';
import type { Scribe, WriteText } from './writer.ts';

/** What the model is told about a landmark. `unlike` are names the reply must not repeat. */
export type SignBrief = {
  readonly noun: string;
  readonly biome: Biome;
  /** Short phrases such as 'by the water', from `describeScreen`. */
  readonly around: readonly string[];
  readonly unlike: readonly string[];
};

const corners = (terrain: Terrain) => (screen: Screen) =>
  screen.corners.filter((t) => t === terrain).length;
const features =
  (...kinds: Feature[]) =>
  (screen: Screen) =>
    screen.features.filter((f) => kinds.includes(f)).length;

const AROUND: readonly { phrase: string; at: number; count: (screen: Screen) => number }[] = [
  { phrase: 'by the water', at: 12, count: corners('water') },
  { phrase: 'on a road', at: 8, count: corners('path') },
  { phrase: 'among graves', at: 1, count: features('grave') },
  { phrase: 'under old trees', at: 8, count: features('tree', 'bigtree') },
  { phrase: 'among rocks', at: 4, count: features('rock') },
  { phrase: 'among wildflowers', at: 6, count: features('flowers') },
  {
    phrase: 'by broken fences',
    at: 1,
    count: features(...FENCES.map((f) => `${f}-broken` as const)),
  },
];

/** What stands out on a screen, for a prompt, always in the same order. */
export function describeScreen(screen: Screen): string[] {
  return AROUND.filter(({ at, count }) => count(screen) >= at).map((a) => a.phrase);
}

const safeQuoted = (name: string) => `"${name.replace(/["“”\r\n]/g, ' ').trim()}"`;

export function signPrompt({ noun, biome, around, unlike }: SignBrief): TextRequest {
  const near = around.length > 0 ? `, ${around.join(', ')}` : '';
  const not =
    unlike.length > 0
      ? ` It is not called ${unlike.map(safeQuoted).join(' or ')}; give it a different name.`
      : '';
  return {
    messages: [
      {
        role: 'system',
        content:
          'You name places on signposts in a gentle, cozy exploration game. Reply with two ' +
          'lines: "Name: " and a name of at most four words, then "Line: " and one short ' +
          'sentence of at most twelve words for travellers passing by. No quotation marks, ' +
          'nothing crude or cruel, and no real places or people.',
      },
      { role: 'user', content: `Name a ${noun} in ${LANDS[biome]}${near}.${not}` },
    ],
    maxTokens: 60,
    temperature: 0.9,
  };
}

const NAME_LABEL = /^name\s*:\s*/i;
const LINE_LABEL = /^line\s*:\s*/i;

/**
 * A name and line from the model's reply, or undefined when either is missing or unfit, the name
 * reads as a sentence rather than a name, or it repeats one of `unlike`.
 */
export function cleanSign(
  reply: string,
  unlike: readonly string[],
): { name: string; line: string } | undefined {
  const lines = linesOf(reply);
  const labelled = (label: RegExp) => lines.find((l) => label.test(l));
  const name = cleanLine(labelled(NAME_LABEL) ?? lines[0] ?? '', NAME_MAX, NAME_LABEL);
  const line = cleanLine(labelled(LINE_LABEL) ?? lines[1] ?? '', LINE_MAX, LINE_LABEL);
  if (!name || !line || /[.!?:;]$/.test(name) || name.split(' ').length > 5) return undefined;
  const same = (other: string) => other.toLowerCase() === name.toLowerCase();
  return unlike.some(same) || same(line) ? undefined : { name, line };
}

/** Writes each landmark's words once, while it still shows its seed words. */
export const landmarkScribe: Scribe<TraceNamed<'landmark'>> = {
  kind: 'landmark',
  waiting: (site) => site.sign?.source === 'pending',
  request: (site, _world, screen) =>
    signPrompt({
      noun: LANDMARK_NOUNS[site.poi],
      biome: screen.biome,
      around: describeScreen(screen),
      unlike: site.sign ? [site.sign.name] : [],
    }),
  written: (site, reply) => {
    const sign = site.sign && cleanSign(reply, [site.sign.name]);
    return sign && { ...site, sign: { ...sign, source: 'model' } };
  },
};

export type Suggester = ReturnType<typeof createSuggester>;

/**
 * New names for the rename dialog, for every world on the server: each player may ask a few
 * times in a while, one at a time. Each player's last suggestion is remembered, so asking again
 * moves on from it.
 */
export function createSuggester(
  writeText: WriteText,
  limiter: RateLimiter = createRateLimiter(SUGGEST_LIMITS.perUser),
) {
  const thinking = new Set<number>();
  const last = new Map<number, string>();

  const ask = async (userId: number, brief: SignBrief): Promise<TextResult> => {
    thinking.add(userId);
    try {
      return await writeText(signPrompt(brief));
    } catch (error) {
      return { kind: 'error', message: String(error) };
    } finally {
      thinking.delete(userId);
    }
  };

  return {
    /** Never throws; every failure is a reason the dialog can show. */
    suggest: async (userId: number, site: Site, screen: Screen): Promise<Suggestion> => {
      if (thinking.has(userId)) return { ok: false, reason: 'Still thinking of one.' };
      const key = String(userId);
      const wait = limiter.retryAfterMs(key);
      if (wait > 0) {
        const minutes = Math.ceil(wait / 60_000);
        return {
          ok: false,
          reason: `That is plenty of new names for now. Try again in ${minutes} min.`,
        };
      }
      limiter.hit(key);
      const shown = wordsOf(site)?.name;
      const unlike = [...new Set([shown, last.get(userId)])].filter((n) => n !== undefined);
      const noun = LANDMARK_NOUNS[site.poi];
      const result = await ask(userId, {
        noun,
        biome: screen.biome,
        around: describeScreen(screen),
        unlike,
      });
      const sign = result.kind === 'ok' ? cleanSign(result.text, unlike) : undefined;
      if (!sign) {
        const why = result.kind === 'ok' ? `filtered "${result.text}"` : result.kind;
        console.warn(`Suggestion for ${userId}: ${why}`);
        return { ok: false, reason: 'No name came to mind. Try again.' };
      }
      last.set(userId, sign.name);
      return { ok: true, ...sign };
    },
  };
}
