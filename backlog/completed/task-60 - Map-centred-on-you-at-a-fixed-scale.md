---
id: TASK-60
title: Map centred on you at a fixed scale
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 13:50'
updated_date: '2026-09-26 13:58'
labels: []
milestone: m-1
dependencies: []
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The world map currently scales to fit every discovered screen, which shrinks as the world grows and invites trying to see the whole world. Instead, the map opens centred on the player's screen with every screen drawn at one fixed size, showing as much of the surroundings as fits the window. Players get a sense of what they have explored nearby, never a view of everything. The scale never depends on how many screens are discovered.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The map opens with the player's screen at the centre of the view, at a fixed size per screen that never depends on how many screens are discovered
- [x] #2 A larger window shows more screens around the player at the same size; a smaller one shows fewer
- [x] #3 The player can still pan to look around and return to their own screen with one key or button; zoom, if kept, only moves between a few fixed sizes chosen by the player
- [x] #4 Labels, whole-pixel snapping and the in-game map overlay keep working, in both the overlay and standalone /map
- [x] #5 Unit or e2e tests show the screen size is the same for a world with 2 discovered screens and one with 500, and that the player's screen is centred
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the map's fit-to-world view with a view that opens centred on the player's screen at a fixed zoom step; delete fit() and the free-scale zoom.
2. Zoom moves between fixed steps in CSS px per tile (2, 3, 4, 6; default 3 = 60x45 per screen), rounded to whole device pixels per tile for the devicePixelRatio; the origin is rounded too so tiles land on whole pixels.
3. Keep drag and arrow-key panning; add C and Home keys plus a 'Centre on me' button.
4. Pure mapLayout/openView functions with unit tests (whole pixels per tile at every dpr, player centred, same size for 2 and 500 screens, bigger canvas shows more screens).
5. e2e: stub /api/map with a 500-screen generated world; assert identical screen size to the 2-screen map, player centred, bigger viewport draws more screens; screenshots of overlay and /map at two sizes.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Defaults chosen: zoom steps are 2, 3, 4 and 6 CSS px per tile; the map opens at 3 (60x45 CSS px per screen, about 16x13 screens in a 960x600 window). Each step is rounded to a whole number of device pixels per tile for devicePixelRatio (3 px at dpr 1, 5 at 1.5, 6 at 2), and the canvas origin is rounded too, so tiles are crisp. Auto-fit is deleted, not left unused. Panning stays (drag, arrow keys). C, Home and a 'Centre on me' button return to your screen at the current zoom; the old 0 key is gone. Zoom is +/-/= and the wheel, one step per 100 deltaY so trackpads do not skip steps.
Validation: pnpm lint, typecheck, format:check, test (891 passed) and pnpm e2e (21 passed). e2e stubs /api/map with 500 generated screens around the garden and asserts the same device px per tile and player rect as the unstubbed map, the player's screen centred, more screens drawn at 1600x1000 than 960x600 in the overlay and standalone /map, and C / Centre on me re-centring.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The map now opens centred on the player's screen at a fixed 3 CSS px per tile (whole device pixels per tile at any pixel ratio), shows as much as the window fits, and never auto-fits the world. Zoom moves between four fixed steps; C, Home or 'Centre on me' returns to you. Verified by unit tests (same layout for 2 and 500 screens, centred at five pixel ratios and four canvas sizes, whole-pixel tiles at every step) and an e2e spec with a 500-screen stubbed map at two window sizes in the overlay and at /map.
<!-- SECTION:FINAL_SUMMARY:END -->
