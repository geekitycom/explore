---
id: doc-4
title: Visual language and asset generation
type: specification
created_date: '2026-09-25 01:37'
updated_date: '2026-09-26 20:29'
---
# Visual language and asset generation

Status: adopted as D21, with the adjustments recorded there. This doc is the proposal as written on 2026-09-24 and is kept as history. The rules now live in doc-5 (Style guide), which `pnpm lint:art` checks in CI, and the species each biome's recipes draw on are in `FLORA` (`packages/core/src/flora.ts`), which differs from the catalogue below. No scenery comes from the pack's nature sheet any more.

Andrew asked for a visual language of our own and a way to generate new assets, possibly grounded in the real world, instead of relying only on Ninja Adventure. Eight biomes (meadow, forest, lakeland, scrubland, desert, highlands, taiga, tundra) need flora, rocks, and ground the pack does not cover.

## What we have

Ninja Adventure gives the current look: 16px tiles, a dark selective outline (#141B1B), light from the top left, chunky clusters, and short colour ramps. The pack ships a 53-colour master palette (`Palette.png`), but its own sheets do not follow it strictly: the nature sheet uses 70 colours, 35 of them outside that palette; the floor sheet uses 27 with 3 outside; the Boy walk sheet 8 with 2 outside. So at the time, the "style" was a feel, not a rule anything checked.

## Proposal

### 1. Write the visual language down, then enforce it

A style guide with rules a script can check:

- **Palette.** One master palette of about 64 colours organised as ramps (4 to 6 steps each), seeded from the Ninja Adventure palette and extended for the new biomes (snow blues, desert ochres, taiga greens, heather purples). Ramps hue-shift: shadows lean cool, highlights lean warm.
- **Light and outline.** Light from the top left. A full dark outline (#141B1B) around objects, as the pack draws it, and none on ground. (The spike found a lighter outline on the lit side would make sprites stand out from the pack.)
- **Scale and perspective.** 16px grid, three-quarter top-down, objects anchored bottom-centre on their tile. Trees one to three tiles tall.
- **Detail density.** Ground textures stay quiet (at most 3 colours per 16px tile), so objects and players read clearly.
- **Per-sprite limits.** At most about 8 colours per object sprite, no semi-transparent pixels except shadows, no stray single pixels.

A palette and style lint runs in CI over every shipped PNG and every generated sprite, and fails the build on a violation. Existing pack art is remapped to the nearest ramp colour once, so everything shares one palette.

### 2. Generate assets from code recipes

Most scenery is procedurally describable, and we already do this for terrain transitions and butterflies. Move scenery to parameterised recipes: pure functions from `(recipe params, seed)` to RGBA pixels, drawn with the palette ramps and the rules above.

- **Families:** tree (canopy shape round, conical, columnar, or spreading; clump size; trunk height; ramp), bush, rock (faceted blob with light-side highlight), flower, grass tuft, cactus, reeds, mushrooms, ground textures.
- **Variants for free:** each placed object can be a unique seed of its species, so forests stop repeating the same six trees, while staying recognisably one species.
- **Deterministic:** the same seed renders the same sprite on every client, so no image files are needed for generated scenery. An optional build step can bake atlases.
- **Reviewed in the art gallery**, side by side with the pack art they replace, and covered by the style lint.

Characters stay on the pack's walk sheets for now. Animated characters are the hardest thing to generate well, and the avatar system already works.

### 3. Ground it in the real world

- **Species catalogue.** Each biome gets real plants and stones its recipes are modelled on:
  - Meadow: oak, poppy, cornflower, daisy, clover.
  - Forest: beech, oak, fern, mushrooms, moss-covered boulders.
  - Lakeland: willow, reeds, cattails, water lilies.
  - Scrubland: juniper, sagebrush, dry grass.
  - Desert: saguaro, Joshua tree, agave, creosote bush.
  - Highlands: Scots pine, heather, gorse, granite outcrops.
  - Taiga: spruce, larch, lingonberry.
  - Tundra: dwarf willow, cotton grass, lichen-covered rocks.
  Silhouette, proportions, and colour come from the real species, simplified to pixel-art shapes.
- **Palettes from photos.** A tool extracts dominant colours (k-means) from public-domain reference photos of each biome, then snaps them to the nearest palette ramps, so each biome's ground and flora feel like the real place. Reference photos must be public domain or CC0 (for example, US government works on Wikimedia Commons), with sources recorded.
- **Not recommended as a main path:** converting photos directly into sprites (downscale and quantise). It works passably for ground textures and rocks but produces mushy small sprites; at most it is a starting draft for hand editing. Image-generation models are also left out for now: output is hard to keep consistent with a strict palette, and licensing is unsettled.

## Spike result (task-33)

Recipes pass beside the pack for trees, conifers, cacti, and rocks when they copy the pack's own drawing method: a flat-topped canopy in slanted light bands with lighter drips over each band edge, a lit top plane over a front face for rocks, fixed column steps for cacti. Physically shaded blobs looked like a different art style and were dropped. Across 50 seeds per recipe there were no off-palette pixels and at most 8 colours per sprite. Bushes and other small props fell short: at 16px every pixel is a design decision, so they are better as a hand-drawn base shape recoloured and varied by recipe, or drawn by hand. Tells to fix in the real generator: too-regular drips, missing root bases, identical cactus widths and arm shapes, and a crack in the same place on every rock.

## How to decide

Whether code recipes can match hand-made pixel art is something we can find out by building it. The first task is a throwaway spike: recipes for three tree species, a bush, and a rock, rendered next to the pack's versions in the gallery for Andrew to judge. If recipes fall short, the fallback is hand-drawn sprites (by us or commissioned) that follow the same style guide and lint.
