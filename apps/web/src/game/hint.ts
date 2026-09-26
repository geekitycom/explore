import type { Prompt } from '@explore/core';

/** How long the player stands still before a prompt appears. */
export const STILL_MS = 500;
/** How long a message, such as a refusal, stays up. */
export const MESSAGE_MS = 2500;

export const WALK_TIP = 'Arrow keys or WASD to walk. Walk off an edge to explore.';

export type Message = { readonly text: string; readonly at: number };

export type HintInput = {
  readonly now: number;
  /** When the player last stopped; undefined while they move. */
  readonly stillSince: number | undefined;
  readonly message: Message | undefined;
  readonly prompt: Prompt | undefined;
  /** Whether the walking tip is still worth showing. */
  readonly tip: boolean;
};

/** The hint bar's text, or undefined to hide it. */
export function hintText({ now, stillSince, message, prompt, tip }: HintInput): string | undefined {
  if (message && now - message.at < MESSAGE_MS) return message.text;
  if (stillSince === undefined || now - stillSince < STILL_MS) return undefined;
  if (prompt) return `E  ${prompt.label}`;
  return tip ? WALK_TIP : undefined;
}
