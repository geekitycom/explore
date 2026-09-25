---
id: TASK-36
title: Sprite recipe generator
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:37'
updated_date: '2026-09-25 14:03'
labels: []
milestone: m-4
dependencies:
  - TASK-33
  - TASK-34
documentation:
  - backlog/docs/doc-4 - Visual-language-and-asset-generation.md
priority: medium
type: feature
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the lasting version of the recipe approach: deterministic families (tree, bush, rock, flower, grass tuft, cactus, reeds, mushroom) as pure functions from params and seed to palette-constrained pixels, drawn by the client and shown in the gallery. Uses the direction settled by the spike.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each family renders deterministically per seed and passes the style lint
- [x] #2 Placed objects use per-tile seeds so neighbouring trees of one species differ but read as the same species
- [x] #3 Unit tests cover determinism, palette use, and anchoring
- [x] #4 The game renders generated scenery with no visible drop in frame rate
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Data shape in core: Sprite {width, height, anchor, rgba} (RGBA so TASK-35 lints generated sprites and decoded PNGs through one path), plus spriteViolations() implementing doc-5's per-sprite rules (palette, <=8 colours, opaque-or-shadow alpha, stray pixels, full outline).
2. Recipe = discriminated union {family, params} over eight families (tree broadleaf/conifer, rock, cactus, bush, flower, grass, reeds, mushroom); params name ramps so TASK-38 species are just Recipe values. drawRecipe(recipe, seed) is pure; seeded by createRng.
3. Port the spike's drawing method for trees, conifers, cacti, rocks and fix its tells (irregular drips, root bases, varied cactus widths and arms, varied rock cracks). Bushes and flowers from hand-drawn base maps (traced from the CC0 pack) recoloured and varied by recipe.
4. Tests: determinism, palette and style lint across seeds and ramps, anchoring.
5. Web: recipe variants in FEATURE_ART, per-tile seeds from tileHash, canvases cached per recipe and seed; gallery section showing every family and a per-tile-seeded patch.
6. Verify: lint/typecheck/test/format, gallery screenshot, game frame rate on a dense screen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope per the task-33 verdict (D21): recipes for trees, conifers, cacti, rocks in the pack's drawing method; bushes and flowers as hand-drawn base shapes recoloured and varied by recipe. Fix the spike's tells: uneven drips, root bases, varied cactus widths and arms, varied rock cracks.

Data shape: core Sprite {width, height, anchor, rgba}; PixelImage {width, height, rgba} is what styleViolations() takes, so TASK-35 can lint decoded PNGs and recipe output through one function. Recipe = {family, params} union over tree (broadleaf|conifer), bush, rock, flower, grass, cactus, reeds, mushroom; params name ramps, so a TASK-38 species is just a Recipe value. drawRecipe(recipe, seed) is pure (createRng).
Spike tells fixed: drips use irregular gaps and lengths, trunks get uneven root flares, cactus trunk 3-6px and arms 2-3px with varied gaps and elbow heights, rocks get 0-2 cracks at varied positions with bends, plus optional moss.
Bushes and flowers are hand-drawn bases (bush bases traced from the pack's CC0 nature sheet) recoloured from a ramp and varied by seed, per D21.
Game: all tree, bush, rock, flower and tallgrass variants are recipes now (oak, beech, spruce, cherry that sheds petals; leafy and berried bushes; plain and mossy rocks; poppy, daisy, cornflower). The animated pack plant stays. Each tile's seed is tileHash >>> 8 mod 64 (SPECIES_SEEDS), and canvases are cached per recipe and seed. TilesetNature.png is no longer loaded, so it is removed from SHEETS, SOURCES.md, and the shipped files.
Verification: pnpm lint/typecheck/test/format:check pass (230 tests), pnpm e2e 9/9. Recipe tests sweep every sample with each ramp param swapped to every ramp across 24 seeds: no style violations, species only use their own ramps, bottom-centre anchoring. Perf (Chrome, dev server, densest screen of world 98765, 255 features): drawScene 0.4 ms median per frame at 60 fps; featureSprites 0.2 ms per screen warm; each tree sprite 0.24 ms to draw once. bakeTerrain costs 90 ms per screen, pre-existing; follow-up TASK-41.
Screens: /art.html?section=recipes shows every family at 12 seeds and a per-tile-seeded row of each game tree species.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added deterministic sprite recipes to core for eight families (tree, bush, rock, flower, grass tuft, cactus, reeds, mushroom), a Sprite/PixelImage shape with a styleViolations() lint for doc-5's per-sprite rules, and switched the game's trees, bushes, rocks, flowers and tall grass to recipe species seeded per tile. Verified with recipe unit tests (determinism, lint, own-ramp palette use, anchoring over every ramp and 24 seeds), the full test and e2e suites, gallery and in-game screenshots, and a frame-time measurement on the densest screen (0.4 ms per frame, 60 fps).
<!-- SECTION:FINAL_SUMMARY:END -->
