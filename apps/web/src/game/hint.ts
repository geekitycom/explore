import type { Prompt } from '@explore/core';

/** How long the player stands still before a prompt appears. */
export const STILL_MS = 500;
/** How long a message, such as a refusal, stays up. */
export const MESSAGE_MS = 2500;

export const WALK_TIP = 'Click and hold where you want to walk. Walk off an edge to explore.';

/** A line for the player, shown until `until`. */
export type Message = { readonly text: string; readonly until: number };

/** What the hint bar shows; an actionable hint is a prompt that clicking the bar takes. */
export type Hint = { readonly text: string; readonly actionable: boolean };

export type HintInput = {
  readonly now: number;
  /** When the player last stopped; undefined while they move. */
  readonly stillSince: number | undefined;
  readonly message: Message | undefined;
  readonly prompt: Prompt | undefined;
  /** Whether the walking tip is still worth showing. */
  readonly tip: boolean;
};

/** The hint bar's content, or undefined to hide it. */
export function hintText({ now, stillSince, message, prompt, tip }: HintInput): Hint | undefined {
  if (message && now < message.until) return { text: message.text, actionable: false };
  if (stillSince === undefined || now - stillSince < STILL_MS) return undefined;
  if (prompt) return { text: prompt.label, actionable: true };
  return tip ? { text: WALK_TIP, actionable: false } : undefined;
}
