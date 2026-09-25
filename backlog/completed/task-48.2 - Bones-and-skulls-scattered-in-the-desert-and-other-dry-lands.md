---
id: TASK-48.2
title: Bones and skulls scattered in the desert and other dry lands
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 19:18'
updated_date: '2026-09-25 21:17'
labels: []
milestone: m-4
dependencies: []
parent_task_id: TASK-48
priority: medium
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bones, skulls (for example cattle and ram skulls) and rib cages as small scenery, most common in the desert, less often in scrubland and tundra. Built as a recipe family with deterministic per-tile variation and added to the per-biome dressing and flora data (BIOME_PARAMS, PATCHES, FLORA).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A bones recipe family yields skulls, scattered bones and rib cages with per-seed variation
- [x] #2 Desert screens show bones regularly; scrubland and tundra show them rarely; lush biomes never
- [x] #3 Every variant passes pnpm lint:art and uses only palette ramps
- [x] #4 The art gallery shows the family
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Recipe family 'bones' (packages/core/src/recipes/bones.ts): cattle skull, ram skull, scattered bones, rib cage. Hand-drawn grids shaded from the grid (pale top, darker undersides and right edges, outline-dark sockets), with per-seed variation (broken horns, cracks, piece placement, rib count and breaks, shift).
2. New non-blocking feature 'bones' (FEATURES, codec code 'b') placed per tile on bare ground (sand, dirt, snow) at BiomeParams.bones, read unblended from the screen's own biome so lush screens never show bones: desert 1, scrubland 0.2, tundra 0.1, others 0.
3. FLORA: the four bone species in every biome (desert sand ramp, taiga/tundra snow, highlands granite, others stone).
4. Generator output changes: bump GENERATOR_VERSION per D23; stored screens stay as they are.
5. Web: map colour, no sway. Gallery shows the family row and every biome's flora row.
6. Tests: style lint for every species and seed, per-form variation, per-biome placement (desert regular, scrubland/tundra rare, lush none), bones walkable.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Flowers and tall grass need green corners, so desert sand could never hold them: bones could not ride on an existing feature client-side. They are a new non-blocking feature, so generator output changes (GENERATOR_VERSION bump, D23 stitching; stored screens untouched, no wipe).
Blended params leaked bones onto lush screens near desert borders (measured ~2% of meadow/lakeland screens), so featureFor takes the screen biome's own bones density. dressing.test catches the leak (verified by reintroducing it).
Measured over 3 worlds (screens every 4 apart in a 120x120 box): desert 2.5 bones per screen, 84% of screens show some; scrubland 0.30 (25%); tundra 0.29 (25%); meadow, forest, lakeland, highlands, taiga 0.
Verified: pnpm lint, typecheck, test (468 pass), format:check, lint:art; gallery (?section=recipes, ?section=flora) and an in-game desert screen screenshotted via Playwright.

Rebased onto TASK-48.1 fences (16f24d9): bones is appended after the fence features, codec letter 'b' (fences use P/p/S/s/I/i/W/w), GENERATOR_VERSION 7 (fences took 6). Moved the bones hash purpose from 21 to 7 (retired 'trail'), since 21 fell inside the patch range (patch + i for four PATCHES). Added a codec test that every feature round-trips, which fails on a duplicate letter.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bones and skulls now lie about dry lands. A new 'bones' recipe family draws cattle skulls, ram skulls, scattered bones and rib cages from hand-drawn grids, shaded from the grid and varied per seed. A new non-blocking 'bones' feature lands on bare ground (sand, dirt, snow) at BiomeParams.bones, read from the screen's own biome: desert about 2.5 per screen, scrubland and tundra about 0.3, lush biomes never. FLORA lists the four species per biome in its flora ramps. Generator output changed, so GENERATOR_VERSION was bumped (D23); stored screens are untouched. Verified with pnpm lint, typecheck, test, format:check and lint:art, plus Playwright screenshots of the gallery and an in-game desert screen.
<!-- SECTION:FINAL_SUMMARY:END -->
