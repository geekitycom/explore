import { describe, expect, it } from 'vitest';
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  createOpenings,
  randomCode,
  visitCodeSchema,
} from './visitors.ts';
import type { WorldId } from './worlds.ts';

const ONE = 1 as WorldId;
const TWO = 2 as WorldId;
const ANN = { id: 1, name: 'Ann' };
const BEN = { id: 2, name: 'Ben' };

describe('visit codes', () => {
  it('are five capital letters from an alphabet without I, L, and O', () => {
    expect(CODE_ALPHABET).not.toMatch(/[ILO0-9a-z]/);
    for (let i = 0; i < 200; i++) {
      const code = randomCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
    }
    expect(randomCode(() => 0)).toBe('AAAAA');
    expect(randomCode((bound) => bound - 1)).toBe('ZZZZZ');
  });

  it('read a typed code in any case, with spaces and dashes, and refuse anything else', () => {
    expect(visitCodeSchema.parse('abcde')).toBe('ABCDE');
    expect(visitCodeSchema.parse(' ab-cd e ')).toBe('ABCDE');
    for (const bad of ['ABCD', 'ABCDEF', 'ABC1E', 'ABCIE', 'ABCLE', 'ABCOE', '', 'ab cd']) {
      expect(visitCodeSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('openings', () => {
  it('start closed, and no code lets anyone into a closed world', () => {
    const openings = createOpenings();
    expect(openings.of(ONE)).toEqual({ state: 'closed' });
    expect(openings.redeem('ABCDE', BEN.id)).toBeUndefined();
    expect(openings.admits(ONE, BEN.id)).toBe(false);
    expect(openings.close(ONE)).toBeUndefined();
  });

  it('open with a code that admits whoever redeems it, as many as come, until closed', () => {
    const openings = createOpenings({ now: () => 42 });
    const opened = openings.open(ONE, ANN);
    expect(opened).toMatchObject({ state: 'open', host: ANN, openedAt: 42 });
    expect(openings.of(ONE)).toBe(opened);

    expect(openings.redeem(opened.code, BEN.id)?.worldId).toBe(ONE);
    expect(openings.redeem(opened.code, 3)?.worldId).toBe(ONE);
    expect(openings.admits(ONE, BEN.id)).toBe(true);
    expect(openings.admits(ONE, 3)).toBe(true);
    expect(openings.admits(ONE, 4)).toBe(false);
    expect(openings.admits(TWO, BEN.id)).toBe(false);

    expect(openings.close(ONE)?.code).toBe(opened.code);
    expect(openings.of(ONE)).toEqual({ state: 'closed' });
    expect(openings.admits(ONE, BEN.id)).toBe(false);
    expect(openings.redeem(opened.code, 4)).toBeUndefined();
  });

  it('keeps its code while open, and hands out a new one after closing so the old stops working', () => {
    const openings = createOpenings();
    const first = openings.open(ONE, ANN).code;
    expect(openings.open(ONE, ANN).code).toBe(first);
    openings.redeem(first, BEN.id);
    openings.close(ONE);
    const second = openings.open(ONE, ANN).code;
    expect(second).not.toBe(first);
    expect(openings.redeem(first, 3)).toBeUndefined();
    expect(openings.admits(ONE, BEN.id)).toBe(false);
    expect(openings.redeem(second, 3)?.worldId).toBe(ONE);
  });

  it('never gives two open worlds the same code, even when the generator repeats itself', () => {
    const drawn = ['SAMEA', 'SAMEA', 'SAMEA', 'OTHER'];
    const openings = createOpenings({ newCode: () => drawn.shift()! });
    expect(openings.open(ONE, ANN).code).toBe('SAMEA');
    expect(openings.open(TWO, BEN).code).toBe('OTHER');
    expect(openings.redeem('SAMEA', 3)?.worldId).toBe(ONE);
    expect(openings.redeem('OTHER', 3)?.worldId).toBe(TWO);
  });

  it('knows which worlds a player has open', () => {
    const openings = createOpenings();
    openings.open(ONE, ANN);
    openings.open(TWO, BEN);
    expect(openings.hostedBy(ANN.id)).toEqual([ONE]);
    expect(openings.hostedBy(3)).toEqual([]);
    expect(openings.openWorlds()).toEqual([ONE, TWO]);
  });
});
