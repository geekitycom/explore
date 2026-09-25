---
id: TASK-48.1
title: 'Fence recipes: wooden, metal and stone, intact and broken'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 19:18'
updated_date: '2026-09-25 20:44'
labels: []
milestone: m-4
dependencies: []
parent_task_id: TASK-48
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fences in several styles (for example split-rail and picket wood, wrought-iron metal, dry-stone wall), each with intact and broken or weathered variants. Fences join along a line of tiles, so ends, straight runs and corners must connect cleanly in both axes. Built as recipe families in packages/core/src/recipes with deterministic per-tile variation, and used in world dressing where it fits (for example round town greens, farms, ruins).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Wooden, metal and stone fence styles exist, each with intact and broken variants
- [x] #2 Fence pieces connect cleanly as horizontal and vertical runs, ends and corners
- [x] #3 Every variant passes pnpm lint:art and uses only palette ramps
- [x] #4 Fences appear in generated places where they make sense and never block a road or trap a player
- [x] #5 The art gallery shows every style and variant
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Data shape: four fences (picket, rail, railing, wall) as a table in core; each is two tile features (intact, broken-prefixed) so placement picks condition; codec gets one char each. Fences block.
2. Recipe family 'fence' with params {style, material ramp, broken, links (n/e/s/w bitmask)}. Joined sides run to the tile edge so neighbours meet seamlessly; test lints composited runs, corners and rings (no exemption needed).
3. Links are derived from same-fence neighbours on the screen (core fenceLinks). Seams: the generator never puts a fence on a screen-edge tile, so no fence joins across a seam and both sides agree by construction.
4. Dressing: poi.ts gets fenceRing(rx, ry, fence, {chance, broken}) with a gate mid-side; ruins become broken dry-stone walls, town greens get a picket-fenced flower bed inside the hedge. Bump GENERATOR_VERSION (D23).
5. Client: featureSprites draws fence species per links; gallery shows every style x condition x link mask and a ring; map colours.
6. Verify: pnpm lint/typecheck/test/format:check/lint:art, gallery + in-game screenshots, CI green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fences are four features (picket, splitrail, railing, drystone) each with a -broken variant, codec chars P/p S/s I/i W/w. The client derives each piece's links (core fenceLinks) from same-fence neighbours on the screen, like terrain transitions. Seams: the generator clears fences from screen-edge tiles (onEdge in generateScreen), so nothing ever joins across a seam and both sides agree by construction. fenceRing(rx, ry, fence, {chance, broken}) in poi.ts lays a gated rectangle for TASK-48.3. Placed now: ruins get a broken dry-stone wall ring (replacing rocks), town greens a gated picket-fenced flower bed inside the hedge. Split-rail and iron railing are drawn and in the gallery but not placed yet (no farms; graveyards are TASK-48.3). All fences block; gates plus the screen repair keep every pocket reachable. GENERATOR_VERSION 5 -> 6. Validation: pnpm lint, typecheck, test (480), format:check, lint:art pass; recipes/fence.test.ts lints composited rings, crosses and tees (whole, broken, mixed) and was shown to fail on seam mutations; fences.test.ts fails if the edge rule is removed. Gallery section /art.html?section=fences and in-game town and ruin screenshots checked.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a fence recipe family (picket, split-rail, iron railing, dry-stone wall; whole and broken) whose pieces join neighbours into runs, corners, tees and crossings, placed as broken dry-stone walls round ruins and a gated picket fence round town-green flower beds (GENERATOR_VERSION 6). Verified with composite style-lint tests, generator tests, the fences gallery section and in-game screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
