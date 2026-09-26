---
id: TASK-56
title: Map labels never overlap each other
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 12:51'
updated_date: '2026-09-26 12:56'
labels: []
milestone: m-1
dependencies: []
type: bug
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On the world map (/map and the in-game map overlay), the You and Garden labels draw at the same spot above the screen they mark, so a player standing in the garden reads 'GaYoun'. Landmark names (TASK-50.2) are map labels too, so any labels on one screen or crowded neighbouring screens can collide. Labels must stay readable at every zoom.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When the player is on the garden screen, the You and Garden labels do not overlap
- [x] #2 When the player is on a named landmark's screen, the You label and the landmark name do not overlap
- [x] #3 Labels on adjacent named screens do not overlap at any zoom level
- [x] #4 A unit test checks label boxes never intersect for these three cases at several zoom levels, and failed before the fix
- [x] #5 Screens still snap to whole pixels (TASK-43)
- [x] #6 Fixed garden case screenshotted in the map overlay and on standalone /map
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extract label layout from draw() into a pure, exported function that returns each label's device-pixel box (text, colour, size, position), used by draw().
2. Unit test: boxes never intersect for player in garden, player on a named landmark screen, adjacent named screens, across zooms and DPRs. Confirm it fails on the extracted-but-unfixed layout.
3. Fix: place labels greedily in fixed order (You, Garden, landmark names); a label that would hit an already placed box moves up above it until clear. Positions rounded to whole pixels.
4. Verify in the browser: garden case in the overlay and on /map, screenshots; lint, typecheck, test, format, e2e map spec.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Root cause: each label was drawn at its own anchor (marker labels at the top-centre of their screen, names above their signpost) with no knowledge of the others, so You and Garden on one screen drew at the identical spot.
Default chosen: You keeps its spot directly above its screen; Garden and names that would touch it rise above (reads Garden over You). Names can end up stacked above their signpost when crowded at low zoom.
Before fix: map-view.test.ts label cases 44 failed / 46 passed (You/Garden, Garden/Hare Stones, The Weeping Mere/Old Crow Hollow, ...). After: 90 passed. Label boxes are whole pixels; screenRect snapping test unchanged and passing.
Screenshots (Playwright, new player in the garden): before scratchpad/labels-before/{overlay,standalone}.png, after scratchpad/labels-after/{overlay,standalone}.png.
pnpm lint, typecheck, format:check, test (751 + perf) pass; playwright map + landmarks specs pass.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Map labels (You, Garden, landmark names) are now laid out by mapLabels in apps/web/src/map/map-view.ts: each claims its spot in order and a label that would touch one already placed rises above it, so labels never overlap at any zoom. Verified with a unit test over garden, landmark-screen and adjacent-named-screen cases at six zooms and two pixel ratios (failed 44/90 before the fix), Playwright screenshots of the garden in the overlay and on /map, and the full lint/typecheck/test/format/e2e map checks.
<!-- SECTION:FINAL_SUMMARY:END -->
