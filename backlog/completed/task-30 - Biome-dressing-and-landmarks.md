---
id: TASK-30
title: Biome dressing and landmarks
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 16:36'
labels: []
milestone: m-3
dependencies:
  - TASK-29
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: medium
type: feature
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make places feel designed: landmarks at points of interest (stone circle, ruin, lone tree, lakeside beach), bushes along forest edges, capped lake sizes, and sub-patches such as flower fields within a biome (v2 design doc).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each point-of-interest kind has a recognisable landmark
- [x] #2 Forest edges show an undergrowth band
- [x] #3 Biomes show internal variation visible in the preview
- [x] #4 No landmark blocks a road
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Measure: add per-biome feature shares to the world preview (baseline: forest 11.6% trees, taiga 10.8%, scrubland 0.2% bushes despite bushes 2.5, because every chance was tested against one clumped value near 0.5).
2. Biome table (biome.ts BIOME_PARAMS): add undergrowth (bush band along the woods edge) and sub-patch shares (flower fields, tree stands, thickets, rock fields), retune trees so forest and taiga read as woods. All per-biome dressing stays in this table.
3. Generator (generate.ts): place trees from the clumped stand, other features from independent rolls; bushes in a band just outside the woods edge; patches from their own detail fields via a PATCHES table; lakes on a finer grid with clustered chance, varied sizes, extra lobes, and a radius cap.
4. Landmarks: a Mark list per POI kind in POI_KINDS (stone circle, broken ruin walls, lone big tree in a clearing, tree ring grove, beach boulders, town square, cave rock mound). Plan.landmark exposes marks; roads and crossings still clear blocking marks, so no landmark blocks a road. New feature bigtree for the lone tree (codec, web art, map colours, preview).
5. Bump GENERATOR_VERSION to 3 (D23: stored screens stay, new ones stitch).
6. Tests: landmark present per kind, no blocking feature on road tiles, forest tree share floor, undergrowth band, lake size cap. Then lint/typecheck/test/format, e2e, in-game screenshots of each landmark and a forest edge.

7. Revised during work: roads stop at the edge of a footprint that holds a landmark (instead of clearing through it), and a footprint small enough to fit settles within one screen so its landmark is seen whole.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline (seed 1, 96x96 screens): forest 11.6% trees, taiga 10.8%, scrubland 0.2% bushes. Cause: every chance was tested against one clumped value near 0.5, so small chances never fired. Now trees use the clumped stand and other features roll on their own; forest ~26%, taiga ~25% trees (preview prints per-biome shares).
Lakes: 40x32 lake cells, chance scaled by a slow lake-district field, lobes on lakes wider than 6, extent capped at 13 lattice points (no lake spans more than 26). Shores are patchy. Lobes can shut off a one-tile sliver of shore; repair now fills such pockets with a rock.
POI placement tries 12 candidate spots (was 6): with more lakes, all 6 were sometimes wet and the point fell back into a lake. Lakeside shore distance is now 2 so the beach touches the water.
Town footprint (20x14 tiles) cannot settle within one screen, so its hedged green can straddle a seam.
Tests: new packages/core/src/dressing.test.ts (landmark per kind, marks inside footprint, footprint on one screen, no blocking feature on a road, forest/taiga tree share, undergrowth band vs open land, scrubland thickets, lake span cap). Mutation-checked: zeroing undergrowth and raising LAKE_EXTENT each fail their test.
Checks: pnpm lint, typecheck, test (404 passed), format:check, e2e (11 passed).
Screenshots (in-game, seed 1): /private/tmp/claude-501/-Users-andrewshell-code-geekity-explore/5fcbf254-9b57-47b2-a2bf-c0a00fadf132/scratchpad/shots/landmark-{stones,ruin,clearing,grove,lakeside,town,cave}.png and /private/tmp/claude-501/-Users-andrewshell-code-geekity-explore/5fcbf254-9b57-47b2-a2bf-c0a00fadf132/scratchpad/shots/landmark-forest-edge.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Points of interest show landmarks (stone circle, ruin walls, lone big tree in a clearing, tree-ring grove, beach boulders, hedged village green, rocky cave mouth); roads stop at their footprints. Per-biome dressing lives in BIOME_PARAMS: undergrowth bushes along thinning woods, flower fields, tree stands, thickets and rock fields. Forests now read as forests. Lakes are capped at 26 lattice points across, cluster, vary in size, and have lobes and patchy shores. GENERATOR_VERSION 3 (D23). Verified with dressing tests, full suite, e2e, previews, and in-game screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
