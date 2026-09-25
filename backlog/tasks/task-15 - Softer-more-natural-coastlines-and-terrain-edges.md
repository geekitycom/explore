---
id: TASK-15
title: 'Softer, more natural coastlines and terrain edges'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 23:22'
updated_date: '2026-09-25 14:37'
labels: []
milestone: m-1
dependencies: []
priority: low
type: enhancement
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Large coastlines stair-step because terrain lives on a 16px corner grid, and land edges read as rounded rectangles rather than the pack's tufted grass fringe (see task-4 notes). Improve the look without changing the stored screen format or seam guarantees (decision-9, decision-17).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Diagonal coastlines read as smooth curves rather than stairs in the art gallery and in game
- [x] #2 Grass edges show a tufted fringe consistent with the Ninja Adventure style
- [x] #3 Mask border-agreement tests still pass, and screens still match across seams
- [x] #4 No change to the persisted screen record
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an 'edges' gallery section (coastline and inland edges across four screens, all six terrains) and screenshot it as the baseline.
2. Replace the per-tile corner-falloff masks with a marching-squares field: each lattice corner gets a signed value, firmer the more its 3x3 neighbours agree (floored so lone corners survive); inside a tile the field is the bilinear blend of the four corner values.
3. Seams: border corners weigh only neighbours along the border, screen corners only themselves; the screen's outermost pixel ring samples the border line itself, and edge-band distances on that ring look only along it. Both screens then draw identical seam pixels.
4. Per-terrain fringe as a pixel shift along the field's slope: TUFTS for grass and darkgrass (outline moved outside so blades read as grass with an olive rim), WAVES elsewhere. Each tile uses the fringe of the lowest terrain at or above the layer, so intermediate layers never halo or sliver.
5. Tests for corner pixels, empty all-outside tiles, no speckle, straight diagonals, shallow slopes, tufts vs smooth shores, fringe choice, and seam identity (mask and composed, every terrain); mutation-check them. Verify lint/typecheck/test/format and before/after screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Replaced the 16 fixed overlay masks with a per-screen marching-squares field (apps/web/src/art/mask.ts). Diagonals now run straight and curves round instead of stair-stepping; the octagonal look of small lattice circles is intrinsic to the corner data.
Grass and darkgrass edges get pointed tufts (TUFTS fringe) with the olive outline moved to the outer ring, matching the pack's grass-over-dirt tiles. Sand, dirt, snow, and shores keep a gentle wave.
AC3: the old per-mask border tests assumed every tile side is crossed square-on, which is exactly what made stairs, so they were replaced by stronger seam tests: two screens cut from one lattice must draw the same pixels (region, edge distance, and composed colour for all six terrains) on both sides of east and south seams. A 12-world probe found 0 seam differences in 6720 seam pixels. Interior tile sides are now continuous rasterisations rather than exact mirrors, as intended.
Mutation checks: dropping the border pass fails both seam tests; 2D distance on the border fails both; removing neighbour smoothing fails the diagonal test; nearest-corner sampling fails 4 tests; flat tufts fail the tuft test; removing the despeckle pass fails the speckle test.
No change to Screen, codec, or server. composeTerrain cost measured at about +5% (edge distance still dominates).
Screenshots (before/after, same lattices): scratchpad t15/before-edges-0.png vs after-edges-0.png (coastline), before-edges-1.png vs after-edges-1.png (inland), before-world-1.png vs after-world-1.png (garden with neighbours).

After rebasing onto the palette remap (17212b6), kept its band colours and moved the grass and darkgrass outlines to the outer ring. Re-verified: lint, typecheck, 321 tests, format all pass. Final before/after screenshots on the same base are final-before-edges-{0,1}.png, final-after-edges-{0,1}.png, final-before-world-1.png, final-after-world-1.png in the session scratchpad t15 folder.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Terrain edges now use a marching-squares field: corner values firmed by their neighbours, blended bilinearly per tile, plus a per-terrain fringe. Diagonal coastlines run straight and curves round instead of stair-stepping; grass and darkgrass edges get pointed tufts with an outer olive rim; shores and other terrains keep a gentle wave. Seams stay exact: the screen's outer pixel ring samples the border line and bands it along the border only. Screen records, codec, and server are untouched. Verified with new mask and composed seam tests (all six terrains), mutation checks, a 12-world seam probe (0 differences), lint/typecheck/test/format, and before/after gallery screenshots of the same coastline and inland edges.
<!-- SECTION:FINAL_SUMMARY:END -->
