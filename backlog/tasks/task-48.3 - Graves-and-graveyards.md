---
id: TASK-48.3
title: Graves and graveyards
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 19:18'
updated_date: '2026-09-25 21:30'
labels: []
milestone: m-4
dependencies:
  - TASK-48.1
parent_task_id: TASK-48
priority: medium
ordinal: 49000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Grave markers (headstones, wooden crosses, cairns, open or sunken graves) and a graveyard point of interest: a fenced plot of graves, sometimes overgrown or with a broken fence, registered in POI_KINDS so roads can reach it. Lone graves may also appear by roadsides or ruins. Generator output changes follow decision D23 (bump GENERATOR_VERSION; stored screens keep their look).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Grave marker variants exist as recipes, passing pnpm lint:art
- [x] #2 A graveyard POI kind generates a fenced plot of graves that a road reaches
- [x] #3 Graveyards and lone graves never block a road or trap a player
- [x] #4 Stored screens are unchanged (D23)
- [x] #5 The art gallery shows graves; an in-game screenshot shows a graveyard
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. grave recipe family (headstone, wooden cross, cairn, open grave) in recipes/grave.ts, per-seed lean, cracks, chips, inscription, moss.
2. New blocking 'grave' feature (codec 'G'), FLORA lists the four markers per biome in its own flora ramps.
3. POI_KINDS: 'graveyard' (iron railing, lush biomes) and 'burialground' (split-rail, overgrown, dry and cold biomes), both a gated fenceRing(4,3) round two rows of graves beside a central aisle; a lone grave in ruins.
4. GENERATOR_VERSION 7 -> 8 (D23).
5. Tests: recipe variety and lint, landmark keeps every rolled grave and fence (fails on a trapping layout) and a road reaches it, no fence on screen edges.
6. Verify: lint, typecheck, test, format:check, lint:art, e2e; gallery and in-game screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Graves block, like rocks. Layout: fenceRing(4,3) gates at the middle of each side; graves only in rows dy=+-1 at dx=+-1..3, so the aisle row dy=0, the column dx=0 and the walks at dy=+-2 stay open and no tile is shut in. The dressing test that every rolled grave and fence piece is on the ground fails when graves also fill the aisles (checked by mutation), since repair() then carves them.
Two kinds instead of per-instance variants: iron 'graveyard' (meadow, forest, lakeland, highlands; 30% broken, light weeds) and wooden 'burialground' (scrubland, desert, taiga, tundra; 50% broken, heavy weeds, bushes in the corners). Tall grass only grows on green ground, so snowy and sandy burial grounds show bushes but no weeds.
Lone graves: ruins get one grave (60%). Roadside lone graves were left out: featureFor has no road plan access and the AC does not need them.
Open graves carry no marker; the material param is unused for that form.
GENERATOR_VERSION 7 -> 8; stored screens keep their look (D23), no wipe needed.
Validation: pnpm lint, typecheck, test (502 pass), format:check, lint:art, e2e (11 pass). Screenshots: gallery flora (desert, tundra, meadow), recipes, in-game graveyard (seed 1, screen 1,-23) and burial ground (seed 1, screen -12,-30).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Graves and graveyards. A grave recipe family draws headstones, wooden crosses, cairns and open graves, weathered per seed (leaning, cracked, chipped, mossy). A blocking 'grave' feature lists them per biome in its flora ramps. Two POI kinds join POI_KINDS: an iron-railed graveyard in lush biomes and an overgrown split-rail burial ground in dry and cold ones, each a gated fence ring round two rows of graves beside open aisles, so no tile is shut in and roads reach them. Ruins may hold a lone grave. GENERATOR_VERSION 8 (D23). Verified with lint, typecheck, test, format:check, lint:art, e2e, plus gallery and in-game screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
