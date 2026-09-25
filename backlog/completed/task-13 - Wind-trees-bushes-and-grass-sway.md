---
id: TASK-13
title: 'Wind: trees, bushes, and grass sway'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 23:22'
updated_date: '2026-09-25 01:18'
labels: []
milestone: m-1
dependencies: []
priority: medium
type: feature
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the world feel alive with wind. The pack has no sway frames for trees or grass, so sway is procedural: shift the top rows of canopy and grass sprites by a pixel on a slow cycle, with the phase travelling across the screen so gusts visibly roll through. Flowers use the pack's 4-frame animated plant (Backgrounds/Animated/Plant). Tall grass should rustle when a player walks through it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Tree canopies, bushes, and tall grass sway with a gust that travels across the screen; trunks stay still
- [x] #2 Sway is 1px pixel-art motion with no blurring or sub-pixel smearing
- [x] #3 Flowers animate using the pack's animated plant frames
- [x] #4 Tall grass rustles when any player walks through it
- [x] #5 Neighbouring screens look continuous when walking across a seam
- [x] #6 Motion is disabled or reduced when the user prefers reduced motion
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Shared animation layer built once per screen (art/scene.ts), drawn by the game renderer and the art gallery. All motion is a pure function of (screen, world position, clock), so every player sees the same thing and it is unit-testable. A live prefers-reduced-motion flag freezes the clock and hides critters. Evidence: gallery section rendering the same screens at several clock values, screenshots, plus unit tests.
Wind: FEATURE_ART entries gain a sway spec (rows that stay still, bands above). Each band shifts by -1, 0, or +1 px from a gust wave keyed to world x, so gusts travel across seams. Flowers use the pack's 4-frame animated plant. Tall grass jiggles while a moving player's feet are on it.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shared scene layer: art/scene.ts (build once per screen, draw per frame), art/wind.ts (gust, sway slices), art/life.ts (water twinkle, butterflies, fish, petals). Motion uses wall-clock time so players on the same screen see roughly the same thing. Gallery section /art.html?section=motion renders fixed clock values for review.
Measured in Chrome (4x scale): draw per frame 0.11 ms all-water, 1.14 ms for 300 swaying trees and grass, 0.27 ms garden. Scene build about 90 ms per screen, almost all the pre-existing terrain bake.
e2e/ambience.spec.ts: the garden canvas changes over 700 ms with motion; with prefers-reduced-motion it is pixel-identical. Playwright now runs one worker so other tests' players can't wander into these frames.
Wind: FEATURE_ART variants carry a sway spec (still rows + bands). Round trees still 9 rows, pines 7, bushes 6, grass 5, flowers 7. Offsets are only -1, 0, or +1 px (unit tested), drawn from whole-pixel source slices, so nothing smears. The gust wave is keyed to world x (test: continuous across a seam). The daisy flower variant now plays the pack's 4-frame animated plant. Tall grass jiggles while a moving player's feet are on its tile.
Measured over 40 generated screens: 26 of 29 isolated trees moved within the sampled frames (the rest were in calm moments); changed pixels inside trunk rows came only from a lower neighbour's canopy, never the tree itself.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Trees, bushes, flowers, and tall grass now sway in pixel-crisp one-pixel steps under gusts that roll across seams, trunks stay put, daisies animate with the pack's frames, and tall grass rustles when walked through. Reduced motion freezes it. Verified with unit tests, in-browser pixel measurement, gallery review, and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
