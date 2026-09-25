---
id: TASK-12
title: Animated water
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
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Water is a static baked image. Bring ponds and lakes to life with the Ninja Adventure animated ripple sheet (Backgrounds/Animated/Water Ripples, 4 frames) and the water tileset variants (ripple, shine, lily pad, fish shadow). Terrain is baked once per screen (doc-1 Rendering), so animation must be layered or pre-baked as a few frames rather than recomposed every frame.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Open water visibly animates (ripples or shimmer) on a loop
- [x] #2 Some water tiles carry lily pads or fish shadows, chosen deterministically per tile
- [x] #3 Shorelines and seams stay identical to the static render
- [x] #4 Frame rate stays smooth with a screen full of water
- [x] #5 Animation pauses or is reduced when the user prefers reduced motion
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Shared animation layer built once per screen (art/scene.ts), drawn by the game renderer and the art gallery. All motion is a pure function of (screen, world position, clock), so every player sees the same thing and it is unit-testable. A live prefers-reduced-motion flag freezes the clock and hides critters. Evidence: gallery section rendering the same screens at several clock values, screenshots, plus unit tests.
Water: interior water tiles (whole 3x3 neighbourhood is open water) twinkle by cycling the pack's plain, ripple, and shine water tiles on staggered per-tile phases; shores are never redrawn, so they stay identical to the static render.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shared scene layer: art/scene.ts (build once per screen, draw per frame), art/wind.ts (gust, sway slices), art/life.ts (water twinkle, butterflies, fish, petals). Motion uses wall-clock time so players on the same screen see roughly the same thing. Gallery section /art.html?section=motion renders fixed clock values for review.
Measured in Chrome (4x scale): draw per frame 0.11 ms all-water, 1.14 ms for 300 swaying trees and grass, 0.27 ms garden. Scene build about 90 ms per screen, almost all the pre-existing terrain bake.
e2e/ambience.spec.ts: the garden canvas changes over 700 ms with motion; with prefers-reduced-motion it is pixel-identical. Playwright now runs one worker so other tests' players can't wander into these frames.
Water: only open-water tiles (3x3 neighbourhood all water) twinkle, 25% of them, each showing the pack's shine then ripple tile for about a quarter of a 3.2 s cycle on its own phase. The first pass (45% of tiles, half the cycle) looked busy and was toned down after review. Shores are never redrawn; test asserts twinkles only on open water, and the garden pond is too small to twinkle. Static lily pads and fish-shadow decor tiles stay, and fish glide (task-14).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Open water now twinkles gently with the pack's ripple and shine tiles on staggered per-tile timers, never touching shorelines, and stops under reduced motion. Verified with unit tests, gallery screenshots at fixed clocks, a frame-time benchmark, and a Playwright reduced-motion check.
<!-- SECTION:FINAL_SUMMARY:END -->
