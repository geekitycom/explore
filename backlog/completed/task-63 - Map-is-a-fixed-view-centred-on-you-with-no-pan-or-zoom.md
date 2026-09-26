---
id: TASK-63
title: 'Map is a fixed view centred on you, with no pan or zoom'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 14:44'
updated_date: '2026-09-26 14:55'
labels:
  - web
  - map
dependencies: []
priority: medium
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-60 made the map open centred on the player's screen at a fixed size, but it kept drag and arrow-key panning, wheel and +/- zoom, and a 'Centre on me' button and C key to come back. That still lets a player scroll across a giant world and see everything they have discovered. Instead the map is a fixed window onto the player's surroundings: the player's screen sits in the middle at one fixed size, and they see only what fits the viewport. To see further areas they have to walk closer. This also means the map needs no touch gestures on iPad (see TASK-62).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The map always shows the player's screen at the centre at one fixed size, in both the in-game overlay and standalone /map
- [x] #2 Dragging, the mouse wheel, arrow keys, and +/- do not pan or zoom the map
- [x] #3 The 'Centre on me' button and the C key are gone, and the map's text no longer mentions panning, zooming, or centring
- [x] #4 A larger window still shows more screens around the player at the same size, and resizing keeps the player's screen centred
- [x] #5 Labels and whole-pixel snapping keep working
- [x] #6 Tests show that pan and zoom input leaves the view unchanged, and that the player's screen stays centred
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. map-view.ts: drop ZOOMS/zoom steps, the View type's pan state, wheel/drag/keydown handlers, the zoom>=6 grid, and the 'Centre on me' button. Layout is a pure function of the player's screen: one fixed 3 CSS px per tile, centred on you.sx/you.sy.
2. Keep the hover readout (it does not move the view). Canvas becomes a labelled image with no tabindex; aria-label drops pan/zoom/centre wording.
3. style.css: remove the grab cursor on the map canvas.
4. Unit tests: rewrite map-view.test.ts around the fixed layout (whole device pixels, centred).
5. e2e map.spec.ts: replace pan/zoom/centre steps with a check that drag, wheel, arrows, +/-, and C leave the view unchanged and centred; drop the map focus assertion.
6. Run typecheck, lint, unit tests, and the map e2e spec.

7. Fix the map readout to a fixed height: its min-height was below the font's line height, so the first hover grew it and shrank the canvas by 13px, shifting the map.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed ZOOMS, View, openView, wheel/drag/keydown handlers, the zoom>=6 grid lines, and 'Centre on me'. mapLayout now takes the player's screen directly. The canvas is role=img with no tabindex, since it has no keyboard controls; M/Escape still open and close the overlay from main.ts. Kept touch-action: none on the map canvas so touching it does not scroll or zoom the page on iPad.
The new e2e check caught the readout resizing the map on hover; fixed with a fixed-height readout.
Validation: typecheck, lint, prettier, pnpm test (925 passed), e2e/map.spec.ts 3/3. Full pnpm e2e: 24 passed, 1 flaky failure (wake.spec 'reloading within the timeout' with this change; traces.spec 'inventory bar and hint bar' on unchanged main). Both pass when run alone, so the flakiness predates this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The world map is now a fixed window onto the player's surroundings: their screen sits in the centre at 3 CSS px per tile, and drag, wheel, arrows, +/-, C, and Home no longer pan or zoom it. The 'Centre on me' button is gone and the aria-label no longer mentions panning or zooming. Also fixed the hover readout resizing the map. Verified with map-view unit tests (centred on whole pixels at 5 pixel ratios, same size for 2 or 500 screens, label layout) and e2e/map.spec.ts, which drives drag, wheel, and keys and checks the map state is unchanged.
<!-- SECTION:FINAL_SUMMARY:END -->
