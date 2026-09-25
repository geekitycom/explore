---
id: TASK-38
title: Real-world flora catalogue for the eight biomes
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:37'
updated_date: '2026-09-25 16:50'
labels: []
milestone: m-4
dependencies:
  - TASK-36
  - TASK-27
documentation:
  - backlog/docs/doc-4 - Visual-language-and-asset-generation.md
priority: medium
type: feature
ordinal: 38000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Model each biome's scenery on real species (for example oak and poppies in meadows, spruce and larch in taiga, saguaro and agave in desert, heather and Scots pine in highlands) using the recipe generator, and use them in biome dressing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each biome has at least three recipe species modelled on named real plants or stones
- [x] #2 Biome generation places the catalogue's species with biome-appropriate densities
- [x] #3 The gallery shows each biome's catalogue side by side
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Data shape: packages/core/src/flora.ts exports Species {name, recipe, weight?, sheds?} and FLORA: Record<Biome, Record<PlacedFeature, readonly Species[]>>, the species per biome per placed feature, weighted. Species follow doc-4's catalogue (oak/poppy/cornflower in meadow, spruce/larch/lingonberry in taiga, saguaro/Joshua tree/agave in desert, Scots pine/heather/gorse/granite in highlands, ...).
2. Densities: the generator already places features by blended BIOME_PARAMS; the catalogue weights species within a feature, so the species mix per biome is data. The generator's output is unchanged, so no GENERATOR_VERSION bump.
3. Web: features.ts picks a species from FLORA[screen.biome][feature] by tile hash and weight, derives sway from the recipe family; drop FEATURE_ART and the pack's animated plant (the last pack sprite among features).
4. Tests in core: every catalogued species passes the style lint and uses only its own ramps at many seeds; each wild biome has >= 3 distinct named species; species draw only from BIOME_RAMPS[biome].flora (extend flora ramps where a real plant needs it).
5. Gallery: a Flora section with each biome's catalogue side by side on its ground colour; screenshot plus an in-game screenshot per biome.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Species live in packages/core/src/flora.ts as FLORA: Record<Biome, Record<PlacedFeature, Species[]>>; each Species is {name, recipe, weight?, sheds?}. The generator still decides where each feature goes from the blended BIOME_PARAMS; the renderer (apps/web/src/art/features.ts) picks the species per tile with speciesAt(screen.biome, feature, tileHash), weighted. Generator output is unchanged, so GENERATOR_VERSION stays and no stored screen changes.
Defaults chosen: every biome lists every feature, since border screens can hold a neighbour's features; mushrooms fill the forest and taiga 'flowers' slot; reeds fill the lakeland 'tallgrass' slot; saguaro and Joshua tree fill desert trees. BIOME_RAMPS flora gained the ramps the named plants need (meadow stone and snow, forest poppy and snow, lakeland gold, water, and stone, scrubland heather and rose, taiga snow and stone), and a test keeps each biome's species inside its flora ramps.
Removed the pack's animated plant sheet, the last pack sprite among features.
Verification: pnpm lint, typecheck, format:check, lint:art, test (442 pass). The recipes style-lint and own-ramps tests now run over every FLORA species. Gallery flora section and in-game screenshots per biome taken with Playwright against a real server (seed 9).
Follow-up TASK-45: recipe shapes for agave, barrel cactus, and weeping willow.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a real-world flora catalogue (FLORA in packages/core/src/flora.ts): at least three named species per biome, weighted per feature, drawn from recipes that use only the biome's flora ramps. The client picks each tile's species from its screen's biome, so meadows grow oak, poppies, and daisies; taiga spruce, larch, and lingonberry; desert saguaro, creosote, and agave; highlands Scots pine, heather, and gorse. The gallery's Flora section shows each biome's catalogue side by side. Generator output is unchanged. Verified with lint, typecheck, format, lint:art, the full test suite, and gallery plus in-game screenshots per biome.
<!-- SECTION:FINAL_SUMMARY:END -->
