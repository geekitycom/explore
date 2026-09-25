---
id: TASK-27
title: Biomes across the world
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 14:00'
labels: []
milestone: m-3
dependencies:
  - TASK-26
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: high
type: feature
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Place biomes at world scale (meadow, forest, lakeland, scrubland, desert, highlands, taiga, tundra) using temperature and moisture fields, warped cells, and blended parameters so borders feel organic (v2 design doc). Adds darkgrass and snow terrains with their transitions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Biome regions span several screens and borders blend over roughly a screen rather than a straight line
- [x] #2 Snow never borders desert directly
- [x] #3 Darkgrass and snow render with coherent transitions against every other terrain
- [x] #4 Each stored screen records its biome
- [x] #5 The preview tool shows biome regions for review
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. core: Biome type (eight wild biomes plus garden) and darkgrass/snow terrains in world.ts; screen records gain biome, codec v4.
2. core/biome.ts: pure biome field. Jittered site per 8x8-screen cell, biome from a temperature x moisture (x elevation) table at the site, hot sites next to cold ones demoted so snow never meets desert, garden cell pinned to a meadow site. Tiles take the nearest site to their domain-warped position; params blend over about a screen by distance falloff.
3. generate.ts: terrain, lakes, and features read the blended BiomeParams (ground covers for sand, dirt, snow, darkgrass; tree, bush, rock, flower, tallgrass densities; lake chance and size). Export biomeAt(world, layer, gx, gy) for roads, dressing, music, flora. Screens record the biome at their centre.
4. web: darkgrass and snow fills and edge rings from TilesetFloor, map colours; gallery already renders every pair.
5. preview: fields source reports per-tile biomes so --mode biome shows regions.
6. Tests: biome regions span screens, borders blend, no desert-cold adjacency, record round trip, seams still match. Verify with preview renders and in-game screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Confirmed with Andrew on 2026-09-24: keep all eight biomes (meadow, forest, lakeland, scrubland, desert, highlands, taiga, tundra).

Design: packages/core/src/biome.ts holds BIOME_PARAMS (one BiomeParams per wild biome) and biomeField(seed, pins). Sites are jittered per cell of an 8x8-screen grid centred on the garden; the garden cell is pinned to a meadow site. Biome comes from temperature (4-cell wavelength), moisture, and elevation at the site. A hot site with a raw-cold site within two cells turns temperate. Points take the nearest site to their domain-warped position (warp 40 tiles) and blend every site within 60 distance units of the nearest, which dithers ground over about a screen. generate.ts exports biomeAt(world, layer, gx, gy) -> { biome, cell, params } for roads, dressing, music (cell is the patch id), and flora. Ground picks sand, dirt, snow, darkgrass by thresholding a noise field per terrain against the blended share; lakes use lakeChance and lakeSize from the params at the lake cell centre.
Screens record biome (codec v4, darkgrass 'k', snow 'n'). The garden screen records 'garden'. Stored v3 screens are refused at startup as before (decision D22 current state); the world must be wiped with pnpm world:wipe --yes.
Defaults chosen: cold moist -> taiga, cold dry -> tundra; hot wet -> lakeland; the biome of a screen is the biome at its centre. Biome shares over 8 seeds: meadow 19%, highlands 18%, taiga 14%, tundra 12%, lakeland 12%, forest 11%, desert 8%, scrubland 7%. Generation 2.7 ms per screen (was 1.7).
Web: darkgrass fills from TilesetFloor col 11-15 row 12 with the pack's #56864c edge; snow fills from col 1 row 15 and cols 0-1 row 18 with #d2c9c9/#f2eaf1 rims.
Known weakness: lakeland lakes are still one capped blob per lake cell, so they read as evenly spaced dots (task-30 covers lake shapes).
Validation: pnpm lint, typecheck, test (186 pass), format:check, e2e (8 pass). Mutations: BAND=1 fails the blend test; removing the hot-near-cold demotion fails the snow/sand test. Previews and in-game screenshots in the session scratchpad.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added eight world-scale biomes from temperature, moisture, and elevation at jittered sites, with domain-warped borders and params blended over about a screen, snow kept away from desert, and the garden in a meadow. Terrain, lakes, and features follow the blended params; darkgrass and snow terrains render with pack fills and edge bands; screens record their biome (codec v4); the preview shows biome regions. biomeAt(world, layer, gx, gy) is the pure query for later tasks. Verified with unit tests (regions, blending, snow/sand separation, garden meadow, per-screen biome, terrain pair rendering, preview biome mode), mutation checks, e2e, previews, and in-game screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
