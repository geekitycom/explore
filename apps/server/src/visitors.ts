import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { WorldId } from './worlds.ts';

/** Capital letters only, without I, L, and O, which read as digits; kids type these on iPads. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 5;

/** A code as typed: any case, with spaces and dashes, becomes the letters the world was given. */
export const visitCodeSchema = z
  .string()
  .max(40)
  .transform((typed) => typed.toUpperCase().replace(/[\s-]/g, ''))
  .pipe(
    z
      .string()
      .regex(
        new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`),
        `A code is ${CODE_LENGTH} letters. Check it with your friend.`,
      ),
  );

export function randomCode(pick: (bound: number) => number = randomInt): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[pick(CODE_ALPHABET.length)];
  return code;
}

export type Host = { readonly id: number; readonly name: string };

/** Whether a world lets visitors in, and who has come in with the current code. */
export type Opening =
  | { readonly state: 'closed' }
  | {
      readonly state: 'open';
      readonly code: string;
      readonly host: Host;
      readonly admitted: ReadonlySet<number>;
      readonly openedAt: number;
    };

type Open = Extract<Opening, { state: 'open' }> & { readonly admitted: Set<number> };

const CLOSED: Opening = { state: 'closed' };

export type Openings = ReturnType<typeof createOpenings>;

/**
 * Which worlds are open for visitors, in memory: a restart closes every world. A code belongs to
 * one opening; closing the world ends it, and opening again hands out a new code, so a code
 * shared earlier stops working.
 */
export function createOpenings({ now = Date.now, newCode = randomCode } = {}) {
  const byWorld = new Map<WorldId, Open>();
  const byCode = new Map<string, WorldId>();

  const unusedCode = () => {
    let code = newCode();
    while (byCode.has(code)) code = newCode();
    return code;
  };

  return {
    of: (worldId: WorldId): Opening => byWorld.get(worldId) ?? CLOSED,

    /** Opens the world, or keeps it open with the code it already has. */
    open(worldId: WorldId, host: Host): Extract<Opening, { state: 'open' }> {
      let opening = byWorld.get(worldId);
      if (!opening) {
        opening = { state: 'open', code: unusedCode(), host, admitted: new Set(), openedAt: now() };
        byWorld.set(worldId, opening);
        byCode.set(opening.code, worldId);
      }
      return opening;
    },

    /** Ends the opening and returns it, or undefined when the world was already closed. */
    close(worldId: WorldId): Extract<Opening, { state: 'open' }> | undefined {
      const opening = byWorld.get(worldId);
      if (!opening) return undefined;
      byWorld.delete(worldId);
      byCode.delete(opening.code);
      return opening;
    },

    /** Lets the user into the world the code opens, or undefined when no open world has it. */
    redeem(code: string, userId: number): (Open & { readonly worldId: WorldId }) | undefined {
      const worldId = byCode.get(code);
      const opening = worldId === undefined ? undefined : byWorld.get(worldId);
      if (worldId === undefined || !opening) return undefined;
      opening.admitted.add(userId);
      return { ...opening, worldId };
    },

    admits: (worldId: WorldId, userId: number): boolean =>
      byWorld.get(worldId)?.admitted.has(userId) ?? false,

    /** The worlds this user has open for visitors. */
    hostedBy: (userId: number): WorldId[] =>
      [...byWorld].filter(([, o]) => o.host.id === userId).map(([id]) => id),

    openWorlds: (): WorldId[] => [...byWorld.keys()],
  };
}
