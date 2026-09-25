---
id: TASK-44
title: Tell roads apart from dirt patches
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 15:58'
updated_date: '2026-09-25 17:08'
labels:
  - core
  - web
dependencies:
  - TASK-29
priority: low
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Roads (TASK-29) are rasterised as dirt, the same terrain as the dirt patches in scrubland and highlands, so in those biomes a road merges into the patches on screen and on /map. Give roads a look of their own (for example a worn-path terrain or an edge treatment) so a player can follow one through dirt-heavy land. Roads are marked by the network's plan in core generate.ts (terrainAt), so a change there plus rendering in apps/web is the likely shape; it changes generator output, so bump GENERATOR_VERSION per decision D23.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A road is visually distinct from a dirt patch in the game view and on /map
- [x] #2 Stored screens keep their look; only new screens change (D23)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: add a 'path' terrain (codec 'p') drawn between dirt and grass; terrainAt lays roads as path (fords stay sand). Bump GENERATOR_VERSION 3->4 (D23). No record version bump: old records decode unchanged, the new code is additive.
2. Web: path fill from the pack's unused grey-brown soil tiles (soil ramp colours, lint:art clean), a darker soil rim; map colour and preview colour from the soil ramp; WIND entry.
3. Keep stored screens' look: terrain fill decoration hashes by a fixed per-terrain salt, not the draw index, so inserting a layer does not move decorated fills on stored screens.
4. Tests: roads are path (or sand fords) and path is only on roads; seam and pair tests cover path; road test expectations move from dirt to path.
5. Screenshots before/after of scrubland road (seed 1, screen 3,-8) in game and on /map.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Roads are a new terrain 'path' (codec 'p'), layered between dirt and grass: pack grey-brown soil fill TilesetFloor (12,15) with stick/pebble variants (11,18),(12,18), a #695953 rim and a faint #4E484A shadow, all soil-ramp palette colours; map colour #695953. Fords stay sand, so TASK-32's sand fords are unaffected. GENERATOR_VERSION 3->4; no SCREEN_RECORD_VERSION bump because the new code is additive and old records decode unchanged.
Stored look: decorated fills used the draw index as hash salt, so inserting a layer would have moved decorated grass/darkgrass/snow fills on stored screens. TerrainArt now carries a fixed salt (the old indexes; path 6). Checked by rendering 363 screens from the old generator with the old and new renderers (terrain pixels and map pixels): identical hashes; the same check with one salt changed differs.
By design (D23) roads already stored on v3 screens stay dirt, so a road can change from dirt to path at the frontier between old and new screens; the garden stamp's dirt paths also stay dirt.
Validation: pnpm lint, typecheck, test (445), format:check, lint:art, e2e (11) all pass. Screenshots of seed 1 screen (3,-8), scrubland: scratchpad shots/before-game.png, before-map.png, after-game.png, after-map.png.

Landed as 32e054c; GitHub CI run 36163485677 green.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Roads are now a 'path' terrain of their own (grey-brown worn soil with a dark rim, drawn between dirt and grass; dark soil on /map), so they stay visible through scrubland and highland dirt. Fords stay sand. GENERATOR_VERSION 4 (D23); stored screens render pixel-identical because terrain fill decoration now hashes by a fixed per-terrain salt. Verified with lint, typecheck, 445 unit tests (new: roads are path, fords sand, path nowhere else), format, lint:art, 11 e2e specs, before/after screenshots of a scrubland road in game and on /map, and CI.
<!-- SECTION:FINAL_SUMMARY:END -->
