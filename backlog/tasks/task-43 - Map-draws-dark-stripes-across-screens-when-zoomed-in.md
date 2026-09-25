---
id: TASK-43
title: Map draws dark stripes across screens when zoomed in
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 15:58'
updated_date: '2026-09-25 16:07'
labels:
  - web
  - bug
dependencies: []
priority: low
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On /map, pressing + to zoom in draws thin dark horizontal lines between rows of screens (seen on a 560-screen seeded world while verifying TASK-29; screenshot from that session showed a line at roughly every screen row). The lines are gaps between per-screen images at a non-integer scale, not terrain. Reproduce: seed a world with many visited screens, open /map, focus the map, press +.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Zooming the map in and out shows no gaps or lines between screens
- [x] #2 An e2e or unit check covers the seam at more than one zoom level
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Reproduce on /map over a seeded 560-screen world with a canvas seam probe at several zoom levels.
2. Root cause: each screen is drawn with drawImage at fractional device-pixel edges (15 tiles x 1.25 = 18.75), so Chrome antialiases both neighbours' edges and the dark background shows through the shared row.
3. Fix: snap every screen rectangle to whole device pixels from its own edges (round ox + sx*W*s and ox + (sx+1)*W*s) so neighbours share an edge exactly; use the same rectangle for the grid and markers.
4. Unit test the rectangle at several zoom levels and DPRs; rerun the probe and screenshots; lint, typecheck, test, format, e2e.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Repro: 560 visited screens seeded into a scratch DB, /map driven with Playwright at DPR 1 and 2, pressing + six times. A probe counted seam pixels darker than the texels two rows either side: before 7769/11704 at scale 1.25 and 17944/23864 at 2.44 (DPR 1); after 389 and 709, the same terrain-noise level as scale 1 before (329/9044). Only horizontal lines showed at 1.25 because 20 x 1.25 is whole and 15 x 1.25 is not, which pins the cause on fractional drawImage edges. The scale >= 6 grid lines are intentional and kept; they now use the same snapped rectangles. Test mutation: dropping the rounding fails 18/18 cases. Validation: pnpm lint, typecheck, test (402 passed), format:check, e2e (11 passed).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Zooming /map no longer draws dark lines between screens. Each screen was drawn at fractional device-pixel edges, which the browser antialiased so the background showed through between rows. screenRect now rounds every screen edge to a whole device pixel on its own, so neighbours share edges exactly; tiles, the zoomed-in grid and the markers all use it. Verified with a unit test over six zoom levels and three DPRs, a seam probe and screenshots on a seeded 560-screen world at DPR 1 and 2, and the full lint, typecheck, test, format and e2e suites.
<!-- SECTION:FINAL_SUMMARY:END -->
