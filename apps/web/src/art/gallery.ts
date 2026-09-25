import {
  BIOME_PHOTO_PALETTES,
  BIOME_RAMPS,
  CLOTH_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  LATTICE_H,
  LATTICE_W,
  OUTLINE,
  OVERWORLD,
  PALETTE,
  PALETTE_BIOMES,
  RAMPS,
  SCREEN_H,
  SCREEN_PX_H,
  SCREEN_PX_W,
  SCREEN_W,
  SKIN_TONES,
  TERRAINS,
  TILE,
  cornerIndex,
  generateScreen,
  secretGarden,
  type Avatar,
  type Dir,
  type Feature,
  type RampName,
  type Screen,
  type Terrain,
  type WorldSeed,
} from '@explore/core';
import { AVATAR_BASES, WALK_FRAMES, avatarSheet, walkFrameRect } from './avatars.ts';
import { FEATURE_ART } from './features.ts';
import { featureSprites } from './features.ts';
import { loadArt, type Art } from './load.ts';
import { OVERLAY_MASKS } from './mask.ts';
import { bakeTerrain } from './terrain.ts';
import { butterflies, fishes, twinkles } from './life.ts';
import { buildScene, drawScene, type Actor } from './scene.ts';

const SCALE = 3;
const WALK_ORDER: readonly Dir[] = ['s', 'n', 'w', 'e'];
const root = document.querySelector('#gallery')!;

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  root.append(h, row);
  return row;
}

function figure(parent: HTMLElement, caption: string, w: number, h: number, scale = SCALE) {
  const fig = document.createElement('figure');
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w * scale}px`;
  canvas.style.height = `${h * scale}px`;
  const cap = document.createElement('figcaption');
  cap.textContent = caption;
  fig.append(canvas, cap);
  parent.append(fig);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

function drawScreen(ctx: CanvasRenderingContext2D, screen: Screen, art: Art, ox = 0, oy = 0) {
  ctx.drawImage(bakeTerrain(screen, art), ox, oy);
  const sprites = featureSprites(screen, art).sort((a, b) => a.sortY - b.sortY);
  for (const { image, src, dx, dy } of sprites) {
    ctx.drawImage(image, src.x, src.y, src.w, src.h, ox + dx, oy + dy, src.w, src.h);
  }
}

function blankScreen(fill: Terrain): { corners: Terrain[]; features: Feature[] } {
  return {
    corners: Array<Terrain>(LATTICE_W * LATTICE_H).fill(fill),
    features: Array<Feature>(SCREEN_W * SCREEN_H).fill('none'),
  };
}

/** Masks 0..15 of `upper` over `lower` in a 4x4 grid, spaced so no two share a corner. */
function maskScreen(upper: Terrain, lower: Terrain): Screen {
  const { corners, features } = blankScreen(lower);
  for (let mask = 0; mask < 16; mask++) {
    const tx = 2 + (mask % 4) * 3;
    const ty = 1 + Math.floor(mask / 4) * 3;
    CORNER_OFFSETS.forEach(([dx, dy], bit) => {
      if (mask & (1 << bit)) corners[cornerIndex(tx + dx, ty + dy)] = upper;
    });
  }
  return { coord: { layer: OVERWORLD, sx: 99, sy: 99 }, corners, features };
}

const CORNER_OFFSETS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const;

function showMasks(art: Art) {
  const shapes = section('Overlay shapes 0..15 (NW=1, NE=2, SW=4, SE=8)');
  const ctx = figure(shapes, 'raw masks', 16 * (TILE + 2), TILE, 4);
  OVERLAY_MASKS.forEach((mask, m) => {
    const image = ctx.createImageData(TILE, TILE);
    mask.forEach((v, i) => image.data.set(v ? [240, 230, 200, 255] : [60, 50, 70, 255], i * 4));
    ctx.putImageData(image, m * (TILE + 2), 0);
  });

  const row = section(
    'Every mask of every terrain over every lower terrain (mask n at row n/4, column n%4)',
  );
  TERRAINS.forEach((upper, u) =>
    TERRAINS.slice(0, u).forEach((lower) =>
      drawScreen(
        figure(row, `${upper} over ${lower}`, SCREEN_PX_W, SCREEN_PX_H),
        maskScreen(upper, lower),
        art,
      ),
    ),
  );
}

function showWorld(art: Art) {
  const garden = secretGarden();
  drawScreen(
    figure(section('Secret garden'), 'garden (0,0)', SCREEN_PX_W, SCREEN_PX_H),
    garden,
    art,
  );

  const world = { seed: 7 as WorldSeed };
  const east = generateScreen(world, { layer: OVERWORLD, sx: 1, sy: 0 });
  const south = generateScreen(world, { layer: OVERWORLD, sx: 0, sy: 1 });
  const southEast = generateScreen(world, { layer: OVERWORLD, sx: 1, sy: 1 });
  const seams = section('Garden with its neighbours in world 7 (seams at the middle lines)');
  const ctx = figure(seams, 'garden, (1,0), (0,1), (1,1)', SCREEN_PX_W * 2, SCREEN_PX_H * 2);
  drawScreen(ctx, garden, art);
  drawScreen(ctx, east, art, SCREEN_PX_W, 0);
  drawScreen(ctx, south, art, 0, SCREEN_PX_H);
  drawScreen(ctx, southEast, art, SCREEN_PX_W, SCREEN_PX_H);

  const seeds = section('Generated screens');
  for (const seed of [11, 42, 1234, 98765]) {
    const coord = { layer: OVERWORLD, sx: 5, sy: 5 };
    drawScreen(
      figure(seeds, `world ${seed} at 5,5`, SCREEN_PX_W, SCREEN_PX_H),
      generateScreen({ seed: seed as WorldSeed }, coord),
      art,
    );
  }
}

function showFeatures(art: Art) {
  const row = section('Feature variants');
  for (const [feature, variants] of Object.entries(FEATURE_ART)) {
    const ctx = figure(row, feature, variants.length * 34, 34);
    variants.forEach(({ ref: { sheet, rect } }, i) => {
      ctx.fillStyle = '#adbc3a';
      ctx.fillRect(i * 34, 0, 33, 34);
      ctx.drawImage(
        art.sheets[sheet],
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        i * 34,
        34 - rect.h,
        rect.w,
        rect.h,
      );
    });
  }
}

function showAvatars(art: Art) {
  const bases = section(
    'Avatar bases: original walk sheet, then recolored with the default palette',
  );
  for (const style of HAIR_STYLES) {
    const ctx = figure(bases, `${style} (${AVATAR_BASES[style].sheet})`, 132, 64, 4);
    ctx.drawImage(art.sheets[AVATAR_BASES[style].sheet], 0, 0, 64, 64, 0, 0, 64, 64);
    ctx.drawImage(
      avatarSheet(
        { skin: 'peach', hairStyle: style, hairColor: 'blonde', shirt: 'red', pants: 'purple' },
        art,
      ),
      68,
      0,
    );
  }

  const skins = Object.keys(SKIN_TONES) as Avatar['skin'][];
  const hairs = Object.keys(HAIR_COLORS) as Avatar['hairColor'][];
  const cloths = Object.keys(CLOTH_COLORS) as Avatar['shirt'][];
  const combos: Avatar[] = [];
  HAIR_STYLES.forEach((hairStyle, h) => {
    for (let i = 0; i < 6; i++) {
      combos.push({
        hairStyle,
        skin: skins[(i + h) % skins.length]!,
        hairColor: hairs[(i * 3 + h) % hairs.length]!,
        shirt: cloths[(i * 2 + h) % cloths.length]!,
        pants: cloths[(i * 5 + h + 3) % cloths.length]!,
      });
    }
  });
  const cols = 6;
  const cellW = 4 * TILE + 8;
  const cellH = TILE + 8;
  const grid = section('Avatar combinations walking s, n, w, e');
  const ctx = figure(
    grid,
    'hair style per row',
    cols * cellW,
    Math.ceil(combos.length / cols) * cellH,
    4,
  );
  const draw = (frame: number) => {
    ctx.fillStyle = '#adbc3a';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    combos.forEach((avatar, i) => {
      const sheet = avatarSheet(avatar, art);
      WALK_ORDER.forEach((dir, d) => {
        const r = walkFrameRect(dir, frame);
        const x = (i % cols) * cellW + 4 + d * TILE;
        const y = Math.floor(i / cols) * cellH + 4;
        ctx.drawImage(sheet, r.x, r.y, r.w, r.h, x, y, r.w, r.h);
      });
    });
  };
  let frame = 0;
  draw(frame);
  setInterval(() => draw((frame = (frame + 1) % WALK_FRAMES)), 180);
}

const SWATCH = 12;

function drawRamps(ctx: CanvasRenderingContext2D, names: readonly RampName[], y = 0) {
  names.forEach((name, row) =>
    RAMPS[name].forEach((hex, i) => {
      ctx.fillStyle = hex;
      ctx.fillRect(i * SWATCH, y + row * SWATCH, SWATCH, SWATCH);
    }),
  );
}

function showStyle(art: Art) {
  const ramps = section(
    `Master palette: ${PALETTE.length} colours, outline plus ramps dark to light`,
  );
  const outline = figure(ramps, 'outline', SWATCH, SWATCH);
  outline.fillStyle = OUTLINE;
  outline.fillRect(0, 0, SWATCH, SWATCH);
  for (const name of Object.keys(RAMPS) as RampName[]) {
    drawRamps(figure(ramps, name, RAMPS[name].length * SWATCH, SWATCH), [name]);
  }

  const biomes = section('Biome ramps: ground rows, then flora rows');
  for (const biome of PALETTE_BIOMES) {
    const { ground, flora } = BIOME_RAMPS[biome];
    const gap = ground.length * SWATCH + 4;
    const ctx = figure(
      biomes,
      `${biome}: ground ${ground.join(', ')}; flora ${flora.join(', ')}`,
      6 * SWATCH,
      gap + flora.length * SWATCH,
      2,
    );
    drawRamps(ctx, ground);
    drawRamps(ctx, flora, gap);
  }

  const photos = section(
    'Photo palettes: reference-photo colours (top) snapped to the palette (bottom), width by share',
  );
  const width = 120;
  for (const biome of PALETTE_BIOMES) {
    const { clusters, ramps } = BIOME_PHOTO_PALETTES[biome];
    const ctx = figure(photos, `${biome}: ${ramps.map((r) => r.ramp).join(', ')}`, width, 24, 2);
    let x = 0;
    for (const { colour, snapped, share } of clusters) {
      const w = share * width;
      ctx.fillStyle = colour;
      ctx.fillRect(x, 0, w + 1, 12);
      ctx.fillStyle = snapped;
      ctx.fillRect(x, 12, w + 1, 12);
      x += w;
    }
  }

  const picks = [
    FEATURE_ART.tree[0]!,
    FEATURE_ART.tree[2]!,
    FEATURE_ART.bush[0]!,
    FEATURE_ART.rock[0]!,
    FEATURE_ART.flowers[0]!,
  ];
  const anchoring = section(
    'Scale and anchoring: a 16px grid, each object bottom-centre on its tile (outlined); light from the top left',
  );
  const ctx = figure(
    anchoring,
    'pack sprites on their anchor tiles',
    picks.length * 3 * TILE,
    3 * TILE,
    4,
  );
  ctx.fillStyle = RAMPS.grass[3];
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  picks.forEach(({ ref: { sheet, rect } }, i) => {
    const tx = i * 3 + 1;
    const bottom = 3 * TILE - 4;
    ctx.drawImage(
      art.sheets[sheet],
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      tx * TILE + (TILE - rect.w) / 2,
      bottom - rect.h,
      rect.w,
      rect.h,
    );
    ctx.strokeStyle = RAMPS.rose[1];
    ctx.strokeRect(tx * TILE + 0.5, bottom - TILE + 0.5, TILE - 1, TILE - 1);
  });
  ctx.fillStyle = 'rgb(20 27 27 / 0.25)';
  for (let x = TILE; x < ctx.canvas.width; x += TILE) ctx.fillRect(x, 0, 1, ctx.canvas.height);
  for (let y = TILE - 4; y < ctx.canvas.height; y += TILE) ctx.fillRect(0, y, ctx.canvas.width, 1);
}

const SECTIONS = {
  style: showStyle,
  masks: showMasks,
  world: showWorld,
  features: showFeatures,
  avatars: showAvatars,
  motion: showMotion,
};
function showMotion(art: Art) {
  const params = new URLSearchParams(location.search);
  const base = Number(params.get('t') ?? 0);
  const times = [0, 0.4, 0.8, 1.2, 1.6, 2.0].map((dt) => base + dt);
  const candidates = Array.from({ length: 400 }, (_, i) =>
    generateScreen(
      { seed: 9 as WorldSeed },
      { layer: OVERWORLD, sx: i % 20, sy: 3 + Math.floor(i / 20) },
    ),
  );
  const find = (label: string, test: (s: Screen) => boolean) => {
    const screen = candidates.find(test);
    return screen ? [{ label, screen }] : [];
  };
  const picks = [
    { label: 'garden', screen: secretGarden() },
    ...find('lake', (s) => fishes(s).length > 0 && twinkles(s).length > 20),
    ...find('forest with cherry trees', (s) => {
      const f = featureSprites(s, art);
      return (
        f.filter((x) => x.variant.sheds).length >= 2 && f.some((x) => x.feature === 'tallgrass')
      );
    }),
    ...find('meadow', (s) => butterflies(s).length >= 2),
  ];
  for (const { label, screen } of picks) {
    const scene = buildScene(screen, art);
    const grass = scene.features.find((f) => f.feature === 'tallgrass');
    const walker: Actor[] = grass
      ? [
          {
            x: grass.tx * TILE + 8,
            y: grass.ty * TILE + 10,
            moving: true,
            sortY: grass.ty * TILE + 12,
            draw: () => undefined,
          },
        ]
      : [];
    const row = section(`Motion: ${label} (${screen.coord.sx},${screen.coord.sy})`);
    for (const t of times) {
      const ctx = figure(row, `t=${t.toFixed(1)}s`, SCREEN_PX_W, SCREEN_PX_H, 2);
      drawScene(ctx, scene, art, t, walker, true);
    }
    const still = figure(row, 'reduced motion', SCREEN_PX_W, SCREEN_PX_H, 2);
    drawScene(still, scene, art, times[0]!, walker, false);
  }
}

const only = new URLSearchParams(location.search).get('section');
const art = await loadArt();
for (const [name, show] of Object.entries(SECTIONS)) if (!only || only === name) show(art);
document.body.dataset['ready'] = 'true';
