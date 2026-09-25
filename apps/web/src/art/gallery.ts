import {
  BIOMES,
  BIOME_PHOTO_PALETTES,
  BIOME_RAMPS,
  FENCES,
  FENCE_KINDS,
  FLORA,
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
  RECIPE_FAMILIES,
  SAMPLE_RECIPES,
  SCREEN_H,
  SCREEN_PX_H,
  SCREEN_PX_W,
  SCREEN_W,
  SKIN_TONES,
  TERRAINS,
  TILE,
  brokenFence,
  cornerIndex,
  drawRecipe,
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
import { SPECIES_SEEDS, featureSprites, speciesSprite, spriteCanvas } from './features.ts';
import { tileHash } from './sheets.ts';
import { loadArt, type Art } from './load.ts';
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
  const sprites = featureSprites(screen).sort((a, b) => a.sortY - b.sortY);
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
  return { coord: { layer: OVERWORLD, sx: 99, sy: 99 }, biome: 'meadow', corners, features };
}

const CORNER_OFFSETS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const;

function showMasks(art: Art) {
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

/** Four screens around a shared corner, each built from one global lattice function. */
function drawQuad(
  ctx: CanvasRenderingContext2D,
  art: Art,
  terrainAt: (gx: number, gy: number) => Terrain,
) {
  for (const [sx, sy] of CORNER_OFFSETS) {
    const { corners, features } = blankScreen('grass');
    for (let cy = 0; cy < LATTICE_H; cy++)
      for (let cx = 0; cx < LATTICE_W; cx++)
        corners[cornerIndex(cx, cy)] = terrainAt(sx * SCREEN_W + cx, sy * SCREEN_H + cy);
    const screen = {
      coord: { layer: OVERWORLD, sx, sy },
      biome: 'meadow' as const,
      corners,
      features,
    };
    ctx.drawImage(bakeTerrain(screen, art), sx * SCREEN_PX_W, sy * SCREEN_PX_H);
  }
}

function showEdges(art: Art) {
  const row = section('Edges: four screens each, seams at the middle lines');
  const w = SCREEN_PX_W * 2;
  const h = SCREEN_PX_H * 2;
  const r = (gx: number, gy: number, cx: number, cy: number) => Math.hypot(gx - cx, gy - cy);
  drawQuad(figure(row, 'coastline', w, h, 2), art, (gx, gy) => {
    const d = r(gx, gy, 20, 15) + 1.5 * Math.sin(gx * 0.7) * Math.cos(gy * 0.5);
    if (gx + gy > 50) return 'water';
    if (d < 8) return 'water';
    if (d < 10 || gx + gy > 47) return 'sand';
    return gx < 8 ? 'darkgrass' : 'grass';
  });
  drawQuad(figure(row, 'inland', w, h, 2), art, (gx, gy) => {
    if (r(gx, gy, 30, 10) < 3.5) return 'snow';
    if (r(gx, gy, 30, 10) < 7) return 'darkgrass';
    if (Math.abs(gx - gy * 1.6 - 2) < 2.2) return 'dirt';
    if (r(gx, gy, 12, 22) < 5.5) return 'sand';
    return 'grass';
  });
}

/** Each biome's species side by side on the biome's ground, three seeds each. */
function showFlora() {
  const seeds = [0, 1, 2];
  const cellW = 34;
  const cellH = 3 * TILE + 2;
  for (const biome of BIOMES) {
    const row = section(`Flora: ${biome}`);
    const ground = biome === 'garden' ? 'grass' : BIOME_RAMPS[biome].ground[0]!;
    for (const [feature, species] of Object.entries(FLORA[biome])) {
      for (const s of species) {
        const weight = s.weight ? ` x${s.weight}` : '';
        const ctx = figure(row, `${s.name} (${feature}${weight})`, seeds.length * cellW, cellH, 2);
        ctx.fillStyle = RAMPS[ground][RAMPS[ground].length - 2]!;
        ctx.fillRect(0, 0, ctx.canvas.width, cellH);
        seeds.forEach((seed, i) => {
          const { canvas, sprite } = speciesSprite(s, seed);
          ctx.drawImage(canvas, i * cellW + (cellW - sprite.width) / 2, cellH - sprite.height);
        });
      }
    }
  }
}

const RECIPE_SEEDS = 12;

/** Every recipe family at several seeds, then one species planted with per-tile seeds. */
function showRecipes() {
  const row = section(`Recipe families, ${RECIPE_SEEDS} seeds each`);
  for (const family of RECIPE_FAMILIES) {
    const recipe = SAMPLE_RECIPES[family];
    const sprites = Array.from({ length: RECIPE_SEEDS }, (_, seed) => drawRecipe(recipe, seed));
    const cellW = Math.max(...sprites.map((s) => s.width)) + 4;
    const cellH = Math.max(...sprites.map((s) => s.height)) + 4;
    const ctx = figure(
      row,
      `${family}: ${JSON.stringify(recipe.params)}`,
      RECIPE_SEEDS * cellW,
      cellH,
    );
    ctx.fillStyle = RAMPS.grass[3];
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    sprites.forEach((sprite, i) => {
      ctx.drawImage(
        spriteCanvas(sprite),
        i * cellW + (cellW - sprite.width) / 2,
        cellH - 2 - sprite.height,
      );
    });
  }

  const planted = section('Per-tile seeds: one species per row, neighbours differ');
  const cols = 16;
  const rows = FLORA.garden.tree;
  const ctx = figure(
    planted,
    `game tree species on every other tile of a ${cols}-tile row, ${SPECIES_SEEDS} seeds per species`,
    cols * TILE,
    rows.length * 2 * TILE + TILE,
  );
  ctx.fillStyle = RAMPS.grass[3];
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const coord = { layer: OVERWORLD, sx: 3, sy: 4 };
  rows.forEach((species, r) => {
    for (let tx = 0; tx < cols; tx += 2) {
      const { canvas, sprite } = speciesSprite(species, tileHash(coord, tx, r, 0) >>> 8);
      const bottom = (r + 1) * 2 * TILE + TILE / 2;
      ctx.drawImage(canvas, tx * TILE + TILE / 2 - sprite.anchor.x, bottom - sprite.anchor.y);
    }
  });
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

function showStyle() {
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
    FLORA.meadow.tree[0]!,
    FLORA.forest.tree[2]!,
    FLORA.meadow.bush[0]!,
    FLORA.meadow.rock[0]!,
    FLORA.meadow.flowers[0]!,
  ];
  const anchoring = section(
    'Scale and anchoring: a 16px grid, each object bottom-centre on its tile (outlined); light from the top left',
  );
  const ctx = figure(
    anchoring,
    'game sprites on their anchor tiles',
    picks.length * 3 * TILE,
    3 * TILE,
    4,
  );
  ctx.fillStyle = RAMPS.grass[3];
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  picks.forEach((species, i) => {
    const { canvas, sprite } = speciesSprite(species, 0);
    const tx = i * 3 + 1;
    const bottom = 3 * TILE - 4;
    ctx.drawImage(canvas, tx * TILE + TILE / 2 - sprite.anchor.x, bottom - sprite.anchor.y);
    ctx.strokeStyle = RAMPS.rose[1];
    ctx.strokeRect(tx * TILE + 0.5, bottom - TILE + 0.5, TILE - 1, TILE - 1);
  });
  ctx.fillStyle = 'rgb(20 27 27 / 0.25)';
  for (let x = TILE; x < ctx.canvas.width; x += TILE) ctx.fillRect(x, 0, 1, ctx.canvas.height);
  for (let y = TILE - 4; y < ctx.canvas.height; y += TILE) ctx.fillRect(0, y, ctx.canvas.width, 1);
}

/** Tiles of the fence showcase: a gated pen, runs both ways, a tee, a crossing, a lone post. */
const FENCE_LAYOUT: readonly [number, number][] = [
  ...[1, 2, 3, 5, 6, 7].map((x): [number, number] => [x, 1]),
  ...[1, 2, 3, 4, 5, 6, 7].map((x): [number, number] => [x, 5]),
  ...[2, 4].flatMap((y): [number, number][] => [
    [1, y],
    [7, y],
  ]),
  [1, 3],
  ...[1, 2, 3, 4, 5, 6].map((y): [number, number] => [10, y]),
  ...[13, 14, 15].map((x): [number, number] => [x, 3]),
  [14, 2],
  [14, 4],
  ...[12, 13, 14, 15, 16].map((x): [number, number] => [x, 8]),
  [14, 9],
  [14, 10],
  [18, 12],
];

function showFences(art: Art) {
  for (const fence of FENCES) {
    const row = section(`Fence: ${FENCE_KINDS[fence].name}`);
    for (const broken of [false, true]) {
      const { corners, features } = blankScreen('grass');
      for (const [tx, ty] of FENCE_LAYOUT) {
        features[tx + ty * SCREEN_W] = broken ? brokenFence(fence) : fence;
      }
      for (let x = 1; x <= 8; x++) {
        features[x + 12 * SCREEN_W] = x % 2 ? fence : brokenFence(fence);
      }
      drawScreen(
        figure(
          row,
          broken ? 'broken, above a mixed run' : 'whole, above a mixed run',
          SCREEN_PX_W,
          SCREEN_PX_H,
        ),
        { coord: { layer: OVERWORLD, sx: 99, sy: 99 }, biome: 'meadow', corners, features },
        art,
      );
      const ctx = figure(
        row,
        `${broken ? 'broken' : 'whole'} pieces by links (bits n=1 e=2 s=4 w=8), 3 seeds`,
        16 * (TILE + 4),
        3 * (TILE + 4),
      );
      ctx.fillStyle = RAMPS.grass[3];
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      for (let links = 0; links < 16; links++) {
        for (let seed = 0; seed < 3; seed++) {
          const { material } = FENCE_KINDS[fence];
          const sprite = drawRecipe(
            { family: 'fence', params: { style: fence, material, broken, links } },
            seed,
          );
          ctx.drawImage(spriteCanvas(sprite), links * (TILE + 4) + 2, seed * (TILE + 4) + 2);
        }
      }
    }
  }
}

const SECTIONS = {
  style: showStyle,
  masks: showMasks,
  edges: showEdges,
  world: showWorld,
  flora: showFlora,
  recipes: showRecipes,
  fences: showFences,
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
    ...find('forest', (s) => {
      const f = featureSprites(s);
      return (
        f.filter((x) => x.feature === 'tree').length >= 20 &&
        f.some((x) => x.feature === 'tallgrass')
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
