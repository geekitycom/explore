import { DEFAULT_AVATAR, type PlayerView } from '@explore/core';
import { describe, expect, test } from 'vitest';
import {
  PORTAL_MS,
  portalDone,
  portalLook,
  travellerLook,
  youCanMove,
  type Portal,
} from './portal.ts';

const START = 5000;
const tile = { tx: 4, ty: 6 };
const bob: PlayerView = {
  id: 2,
  name: 'Bob',
  avatar: DEFAULT_AVATAR,
  x: 72,
  y: 106,
  dir: 's',
  moving: false,
};
const portal = (kind: Portal['kind'], traveller: Portal['traveller'] = 'you'): Portal => ({
  kind,
  tile,
  start: START,
  traveller,
});
const at = (ms: number) => START + ms;

describe('portal timeline', () => {
  test('a dot appears, opens into the portal, holds, and closes, in about two seconds', () => {
    const p = portal('arrive');
    expect(PORTAL_MS).toBeGreaterThanOrEqual(1800);
    expect(PORTAL_MS).toBeLessThanOrEqual(2200);
    expect(portalLook(p, at(0))).toEqual({ stage: 'spark', through: 0, size: 0 });
    const dot = portalLook(p, at(250))!;
    expect(dot.stage).toBe('spark');
    expect(dot.size).toBeGreaterThan(0);
    expect(dot.size).toBeLessThan(0.2);
    expect(portalLook(p, at(550))).toMatchObject({ stage: 'opening' });
    expect(portalLook(p, at(1000))).toMatchObject({ stage: 'open', size: 1 });
    const closing = portalLook(p, at(1600))!;
    expect(closing.stage).toBe('closing');
    expect(closing.size).toBeLessThan(1);
    expect(portalLook(p, at(PORTAL_MS))).toBeUndefined();
    expect(portalDone(p, at(PORTAL_MS - 1))).toBe(false);
    expect(portalDone(p, at(PORTAL_MS))).toBe(true);
  });

  test('the size grows without a jump while opening and shrinks to nothing while closing', () => {
    const p = portal('arrive');
    let last = 0;
    for (let ms = 0; ms < 1300; ms += 10) {
      const { size } = portalLook(p, at(ms))!;
      expect(size, `${ms} ms`).toBeGreaterThanOrEqual(last);
      expect(size - last, `${ms} ms`).toBeLessThan(0.1);
      last = size;
    }
    expect(portalLook(p, at(PORTAL_MS - 1))!.size).toBeLessThan(0.01);
  });
});

describe('the traveller', () => {
  test('an arrival is hidden until the portal is open, then steps out in front of it', () => {
    const p = portal('arrive', bob);
    expect(travellerLook(p, at(0))).toEqual({ shown: 0, along: 1 });
    expect(travellerLook(p, at(799))).toEqual({ shown: 0, along: 1 });
    const halfway = travellerLook(p, at(1000))!;
    expect(halfway.shown).toBeCloseTo(0.5);
    expect(halfway.along).toBeCloseTo(0.5);
    expect(portalLook(p, at(1000))!.size).toBe(1);
    expect(travellerLook(p, at(1200))).toBeUndefined();
  });

  test('a departure walks into the open portal, fades, and stays gone', () => {
    const p = portal('depart', bob);
    expect(travellerLook(p, at(0))).toEqual({ shown: 1, along: 0 });
    const stepping = travellerLook(p, at(1000))!;
    expect(stepping.shown).toBe(1);
    expect(stepping.along).toBeGreaterThan(0);
    expect(portalLook(p, at(1000))!.size).toBe(1);
    expect(travellerLook(p, at(1300))).toEqual({ shown: 0, along: 1 });
    expect(travellerLook(p, at(PORTAL_MS + 500))).toEqual({ shown: 0, along: 1 });
  });

  test('you cannot move until you have appeared, nor at all once your portal home opens', () => {
    const arriving = [portal('arrive')];
    expect(youCanMove(arriving, at(0))).toBe(false);
    expect(youCanMove(arriving, at(1199))).toBe(false);
    expect(youCanMove(arriving, at(1200))).toBe(true);
    expect(youCanMove([portal('depart')], at(PORTAL_MS + 1000))).toBe(false);
    expect(youCanMove([portal('arrive', bob), portal('depart', bob)], at(0))).toBe(true);
    expect(youCanMove([], at(0))).toBe(true);
  });
});
