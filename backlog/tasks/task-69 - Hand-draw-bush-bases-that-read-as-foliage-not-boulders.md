---
id: TASK-69
title: 'Hand-draw bush bases that read as foliage, not boulders'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 14:00'
updated_date: '2026-09-27 14:07'
labels:
  - art
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The `bush` recipe in `packages/core/src/recipes/props.ts` stamps one of three bases traced from Ninja Adventure. Recoloured, they read as round slabs: they fill 14 of 16 tile pixels with near-straight sides, and their only texture is a grid of 1px dashes that looks like cracks or stitching. With the sage ramp (which shares three colours with the stone ramp) a bush is hard to tell from a fieldstone; with heather it reads as a purple ball. Replace the bases with new hand-drawn ones built from visible leaf clumps. Also, berries are placed before `despeckle()`, which removes most of them, so Hawthorn, Holly and Gorse show one red pixel or none.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bush bases are new hand-drawn stamps with a scalloped top silhouette and visible leaf-clump separations, narrower than the tile
- [x] #2 Bushes are visibly distinct from rocks in a side-by-side render for every bush leaf ramp (grass, pine, sage, heather)
- [x] #3 Bushes with berries show several berries after drawing
- [x] #4 Every generated bush passes the art lint (palette, colour count, outline, no stray pixels)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Draw 3-4 new 14px-or-narrower bush stamps in props.ts with an extended legend: 3 light, 1 lit, 2 shaded, o dark crevice between clumps. Each stamp carries its own shading, so drop the automatic sun-rim and underside passes that flattened the old bases.
2. Place berries after despeckle so they survive.
3. Render a side-by-side sheet (scratch script) of every bush leaf ramp next to rocks; iterate on the stamps by eye.
4. Run art lint and core tests; update style guide only if the bush rule changes (it does not: bases stay hand-drawn).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the three traced bases with four clump-built stamps (12-14px wide, scalloped tops, dark crevices between clumps) and added `3` (light) to the stamp legend. Berries now go on after despeckle, which used to erase most of them. Kept the sun-rim and underside passes; dropping the rim pass cut seed variation below the recipes.test threshold. Rejected directions (procedural clumps, tree-canopy bands, stems) were sketched in scratch and compared side by side. Verified: side-by-side render vs rocks for grass/pine/sage/heather/berries with 0 style violations; art gallery (art.html) highlands and desert rows checked in Chrome; pnpm test 1006 passed, eslint, prettier, typecheck clean. Colour is untouched: sage bushes are still grey, heather still solid purple.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Bush bases are now four hand-drawn stamps of overlapping leaf clumps with scalloped tops and dark crevices, so bushes no longer read as boulders in any biome. Berries are placed after despeckle and now survive. Verified with a side-by-side render against rocks for every bush ramp (0 style violations), the art gallery in Chrome, and pnpm test (1006 passed), eslint, prettier, typecheck. Leaf colour (grey sage, solid purple heather) is unchanged and can be tuned later.
<!-- SECTION:FINAL_SUMMARY:END -->
