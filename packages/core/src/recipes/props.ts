import type { Hex, RampName } from '../palette.ts';
import type { Rng } from '../rng.ts';
import type { Sprite } from '../sprite.ts';
import { TILE } from '../world.ts';
import { Canvas, clamp, ramp, type Ramp } from './draw.ts';

/**
 * A hand-drawn shape as rows: `.` empty, `o` a dark line, `1` the lit colour, `2` the shaded
 * colour, `3` the light colour. Recipes recolour stamps from a ramp and vary them, so every copy
 * follows the palette.
 */
type Stamp = readonly string[];

/**
 * Bush bases: overlapping leaf clumps, each lit top-left, with a dark crevice where a clump tucks
 * behind the one in front. The scalloped top and the clumps keep a bush from reading as a rock.
 */
const BUSHES: readonly Stamp[] = [
  [
    '.1111.......',
    '133111.1111.',
    '131112133111',
    '111122131112',
    '.22ooooo1122',
    '...11111o22.',
    '..133111o...',
    '.133111o111.',
    '.11111113311',
    '.11111111112',
    '..222222222.',
  ],
  [
    '....1111.....',
    '...13311o111.',
    '.111311113311',
    '133111ooooo12',
    '1ooooo11111o.',
    '.111o1331111.',
    '1331133111112',
    '1311111111122',
    '1111111111222',
    '.22222222222.',
  ],
  [
    '.....1111....',
    '....1331o111.',
    '.111131113311',
    '1331111111112',
    '1oooo2ooooo2.',
    '.1111o11111..',
    '1331o1331111.',
    '1311133111112',
    '1111111111122',
    '.222111111222',
    '.....2222222.',
  ],
  [
    '.....111......',
    '....13311.111.',
    '.1111111213311',
    '13oooo22oooo12',
    '1o1111oo1111o.',
    '.1331ooo33111.',
    '.131o111o1112.',
    '.111133111122.',
    '..2211112222..',
    '.....222......',
  ],
];

const BLOSSOMS: readonly Stamp[] = [
  ['.11.', '1cc2', '1cc2', '.22.'],
  ['.11.', '1cc2', '.22.'],
  ['.1.', '1c2', '.2.'],
];

const LEAF_BASES: readonly Stamp[] = [
  ['..1...1..', '.121.121.', '122212221', '.2222222.'],
  ['.1....1.', '121..121', '12211221', '.222222.'],
  ['...1.....', '1.121.1..', '12222121.', '.2222222.'],
];

function stamp(
  c: Canvas,
  s: Stamp,
  x0: number,
  y0: number,
  colours: Readonly<Record<string, Hex>>,
): void {
  s.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const colour = colours[ch];
      if (colour) c.set(x0 + x, y0 + y, colour);
    }),
  );
}

function tones(r: Ramp): { lit: Hex; shaded: Hex; light: Hex; dark: Hex } {
  const n = r.length;
  return {
    light: r[n - 1]!,
    lit: r[n - 2]!,
    shaded: r[Math.max(0, n - 3)]!,
    dark: r[Math.max(0, n - 4)]!,
  };
}

/** Bottom row a prop stands on; the outline takes the row below it. */
const FOOT = TILE - 2;

export type BushParams = {
  readonly leaves: RampName;
  /** Berries or blossoms dotted through the leaves. */
  readonly berries?: RampName;
};

export function bush(p: BushParams, rng: Rng): Sprite {
  const c = new Canvas(TILE, TILE);
  const leaves = tones(ramp(p.leaves));
  const base = BUSHES[Math.floor(rng() * BUSHES.length)]!;
  const width = base[0]!.length;
  const x0 = clamp(Math.floor((TILE - width) / 2 + rng() * 1.2), 1, TILE - 1 - width);
  const y0 = FOOT - base.length + 1;
  stamp(c, base, x0, y0, {
    '1': leaves.lit,
    '2': leaves.shaded,
    '3': leaves.light,
    o: leaves.dark,
  });

  // Sun on the top-left rim.
  for (let x = x0; x < x0 + width * 0.6; x++) {
    for (let y = y0; y <= FOOT; y++) {
      if (!c.get(x, y)) continue;
      if (c.get(x, y + 1) === leaves.lit && rng() < 0.55) c.set(x, y + 1, leaves.light);
      break;
    }
  }
  // Shaded underside.
  for (let x = x0; x < x0 + width; x++) {
    for (let y = FOOT; y >= y0; y--) {
      if (!c.get(x, y)) continue;
      if (x > x0 + width * 0.3 || rng() < 0.5) c.set(x, y, leaves.dark);
      break;
    }
  }
  c.despeckle();
  if (p.berries) {
    const berry = tones(ramp(p.berries));
    const count = 2 + Math.floor(rng() * 4);
    for (let i = 0, tries = 0; i < count && tries < 40; tries++) {
      const x = x0 + 1 + Math.floor(rng() * (width - 2));
      const y = y0 + 2 + Math.floor(rng() * (base.length - 4));
      if (
        ![c.get(x, y), c.get(x + 1, y), c.get(x, y + 1)].every(
          (v) => v === leaves.lit || v === leaves.shaded,
        )
      )
        continue;
      c.set(x, y, berry.lit);
      if (rng() < 0.5) c.set(x + 1, y, berry.shaded);
      i++;
    }
  }
  c.outline();
  c.shadow(TILE / 2 + 0.5, TILE - 0.8, width / 2 + 1, 1.2);
  return c.toSprite();
}

export type FlowerParams = {
  readonly petals: RampName;
  readonly leaves: RampName;
  /** The flower's eye; defaults to the petals' darkest step. */
  readonly centre?: RampName;
  /** Blossoms per clump, at most. */
  readonly blossoms: number;
  /** Absent in bloom. */
  readonly form?: FlowerForm;
};

/** A picked clump regrows as a sprout, then a bud; a bunch is picked flowers laid down, then wilted. */
export type FlowerForm = 'sprout' | 'bud' | 'bunch' | 'wilted';

const BUD: Stamp = ['1', '2'];

export function flower(p: FlowerParams, rng: Rng): Sprite {
  if (p.form === 'bunch' || p.form === 'wilted') return bunch(p, p.form === 'wilted', rng);
  const c = new Canvas(TILE, TILE);
  const leaves = tones(ramp(p.leaves));
  const petals = tones(ramp(p.petals));
  const centre = p.centre ? tones(ramp(p.centre)).lit : ramp(p.petals)[0]!;
  const leafBase = LEAF_BASES[Math.floor(rng() * LEAF_BASES.length)]!;
  const baseW = leafBase[0]!.length;
  const bx = Math.floor((TILE - baseW) / 2 + (rng() - 0.5) * 2);
  const baseTop = FOOT - leafBase.length + 1;
  const bloom = BLOSSOMS[Math.floor(rng() * BLOSSOMS.length)]!;
  const count = clamp(2 + Math.floor(rng() * (p.blossoms - 1)), 1, Math.min(4, p.blossoms));
  const bloomW = bloom[0]!.length;
  const heads = Array.from({ length: count }, (_, i) => {
    const stemX = bx + 1 + Math.round(((i + 0.2 + rng() * 0.6) / count) * (baseW - 2));
    const x = clamp(stemX - Math.floor(bloomW / 2), 1, TILE - 1 - bloomW);
    return { x, stemX, y: 3 + Math.floor(rng() * 4) };
  });
  if (p.form === 'sprout') {
    stamp(c, leafBase.slice(1), bx, baseTop + 1, { '1': leaves.lit, '2': leaves.shaded });
    c.outline();
    return c.toSprite();
  }
  const budding = p.form === 'bud';
  for (const h of heads) {
    const top = budding ? h.y + bloom.length + 1 : h.y + bloom.length;
    for (let y = top; y < baseTop + 1; y++) c.set(h.stemX, y, leaves.shaded);
  }
  stamp(c, leafBase, bx, baseTop, { '1': leaves.lit, '2': leaves.shaded });
  for (const h of heads) {
    if (budding)
      stamp(c, BUD, h.stemX, h.y + bloom.length - 1, { '1': petals.shaded, '2': leaves.lit });
    else stamp(c, bloom, h.x, h.y, { '1': petals.lit, '2': petals.shaded, c: centre });
  }
  c.outline();
  return c.toSprite();
}

/**
 * Picked flowers laid down, heads to the right: `s` stem, `l` the tie, `1` `2` `d` petals from
 * lit to dark, `c` the eye.
 */
const BUNCH: Stamp = [
  '........1....',
  '..1....1c2.1.',
  '.1c2.s..2.1c2',
  '..2.s.s.s.s2.',
  '...s.sslss...',
  '.sssssss.....',
];
const WILTED: Stamp = [
  '.............',
  '......ss.....',
  '....ss..ss...',
  '..2s.s..s.s..',
  '.dcd.s.s..2c.',
  '..sssslsss.d.',
];

function bunch(p: FlowerParams, wilted: boolean, rng: Rng): Sprite {
  const c = new Canvas(TILE, TILE);
  const leaves = tones(ramp(p.leaves));
  const petals = tones(ramp(p.petals));
  const centre = p.centre ? tones(ramp(p.centre)).shaded : ramp(p.petals)[0]!;
  const shape = wilted ? WILTED : BUNCH;
  const mirrored = rng() < 0.5 ? shape.map((row) => [...row].reverse().join('')) : shape;
  stamp(c, mirrored, 1, FOOT - shape.length + 1, {
    s: wilted ? leaves.dark : leaves.shaded,
    l: leaves.lit,
    '1': petals.lit,
    '2': petals.shaded,
    d: petals.dark,
    c: centre,
  });
  c.outline();
  return c.toSprite();
}

export type GrassParams = {
  readonly blades: RampName;
  /** Seed heads or cotton on the blade tips. */
  readonly tips?: RampName;
  /** Tallest blade in pixels, 5 to 12. */
  readonly height: number;
};

function blade(
  c: Canvas,
  rng: Rng,
  { x, height, lit, shaded }: { x: number; height: number; lit: Hex; shaded: Hex },
): { x: number; y: number } {
  const lean = rng() < 0.5 ? -1 : 1;
  const bendAt = 2 + Math.floor(rng() * Math.max(1, height - 3));
  let bx = x;
  let y = FOOT;
  for (let k = 0; k < height; k++, y--) {
    if (k === bendAt || (k > bendAt && k === height - 2 && rng() < 0.5)) bx += lean;
    c.set(bx, y, lit);
    if (k < height * 0.6) c.set(bx + 1, y, shaded);
  }
  return { x: bx, y: y + 1 };
}

export function grass(p: GrassParams, rng: Rng): Sprite {
  const c = new Canvas(TILE, TILE);
  const blades = tones(ramp(p.blades));
  const tips = p.tips ? tones(ramp(p.tips)) : undefined;
  const count = 4 + Math.floor(rng() * 4);
  const tall = clamp(p.height, 5, 12);
  for (let i = 0; i < count; i++) {
    const x = 3 + Math.round(((i + rng() * 0.8) / count) * 9);
    const centred = 1 - Math.abs(x - 7.5) / 6;
    const height = Math.max(3, Math.round(tall * (0.5 + 0.5 * centred) - rng() * 2));
    const shaded = x > 8 ? blades.dark : blades.shaded;
    const top = blade(c, rng, { x, height, lit: x > 9 ? blades.shaded : blades.lit, shaded });
    if (tips) {
      c.set(top.x, top.y, tips.lit);
      c.set(top.x, top.y - 1, tips.light);
    }
  }
  for (let x = 4; x <= 11; x++) c.set(x, FOOT, x < 8 ? blades.shaded : blades.dark);
  c.outline();
  return c.toSprite();
}

export type ReedsParams = {
  readonly stems: RampName;
  /** Cattail heads; bare reeds without. */
  readonly heads?: RampName;
  readonly tiles: 1 | 2;
};

export function reeds(p: ReedsParams, rng: Rng): Sprite {
  const height = p.tiles * TILE;
  const c = new Canvas(TILE, height);
  const stems = tones(ramp(p.stems));
  const heads = p.heads ? tones(ramp(p.heads)) : undefined;
  const foot = height - 2;
  const count = 3 + Math.floor(rng() * 3);
  const room = height - 4;
  for (let i = 0; i < count; i++) {
    const x = 3 + Math.round(((i + 0.2 + rng() * 0.6) / count) * 9);
    const tall = Math.round(room * (0.55 + rng() * 0.45));
    const lean = x < 7 ? -1 : x > 9 ? 1 : 0;
    const bendAt = Math.floor(tall * (0.6 + rng() * 0.2));
    let sx = x;
    for (let k = 0; k < tall; k++) {
      if (k === bendAt) sx += lean;
      c.set(sx, foot - k, k < tall * 0.4 ? stems.shaded : stems.lit);
    }
    if (heads && rng() < 0.75) {
      const len = p.tiles === 2 ? 4 + Math.floor(rng() * 2) : 3;
      const top = foot - tall + 2;
      for (let k = 0; k < len; k++) {
        c.set(sx, top + k, k === 0 ? heads.lit : heads.shaded);
        c.set(sx + 1, top + k, heads.dark);
      }
    }
  }
  for (let x = 3; x <= 12; x++) c.set(x, foot, x < 8 ? stems.shaded : stems.dark);
  c.outline();
  return c.toSprite();
}

export type MushroomParams = {
  readonly cap: RampName;
  readonly stem: RampName;
  /** Spots on the cap. */
  readonly spots?: RampName;
  /** Mushrooms per cluster, at most. */
  readonly cluster: number;
};

export function mushroom(p: MushroomParams, rng: Rng): Sprite {
  const c = new Canvas(TILE, TILE);
  const cap = tones(ramp(p.cap));
  const stem = tones(ramp(p.stem));
  const spot = p.spots ? tones(ramp(p.spots)).light : undefined;
  const count = clamp(1 + Math.floor(rng() * p.cluster), 1, 3);
  const bodies = Array.from({ length: count }, (_, i) => {
    const big = i === 0;
    const rx = big ? 3 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 2);
    return {
      rx,
      ry: Math.max(2, rx - (rng() < 0.5 ? 0 : 1)),
      stemH: big ? 3 + Math.floor(rng() * 3) : 2 + Math.floor(rng() * 2),
      cx: big ? 7 + Math.floor(rng() * 2) : i === 1 ? 3 + rx - 1 : 12 - rx + 1,
    };
  });
  // Small ones stand in front, so they draw last.
  for (const b of [...bodies].reverse()) {
    const stemW = b.rx >= 3 ? 2 : 1;
    const capBottom = FOOT - b.stemH;
    for (let y = capBottom + 1; y <= FOOT; y++) {
      for (let dx = 0; dx < stemW; dx++) {
        c.set(b.cx - Math.floor(stemW / 2) + dx, y, dx === 0 ? stem.light : stem.lit);
      }
    }
    for (let y = capBottom - b.ry + 1; y <= capBottom; y++) {
      const fy = (capBottom + 1 - y) / b.ry;
      const half = Math.round(b.rx * Math.sqrt(Math.max(0, 1 - (fy - 0.15) ** 2)) + 0.3);
      for (let x = b.cx - half; x <= b.cx + half; x++) {
        const fx = (x - b.cx) / Math.max(1, half);
        let colour = cap.lit;
        if (y === capBottom) colour = cap.dark;
        else if (fx > 0.4 || y === capBottom - 1) colour = cap.shaded;
        else if (fx < -0.1 && fy > 0.6) colour = cap.light;
        c.set(x, y, colour);
      }
    }
    if (spot) {
      const spots = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < spots; i++) {
        const x = b.cx - b.rx + 1 + Math.floor(rng() * (2 * b.rx - 1));
        const y = capBottom - 1 - Math.floor(rng() * Math.max(1, b.ry - 1));
        if (c.get(x - 1, y) && c.get(x + 1, y) && c.get(x, y - 1)) c.set(x, y, spot);
      }
    }
  }
  c.outline();
  c.shadow(TILE / 2 + 0.5, TILE - 0.8, 5, 1.2);
  return c.toSprite();
}
