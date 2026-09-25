---
id: TASK-14
title: 'Ambient life: butterflies, drifting petals, fish'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 23:22'
updated_date: '2026-09-25 01:18'
labels: []
milestone: m-1
dependencies: []
priority: low
type: feature
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Small non-interactive details that make screens feel inhabited: butterflies fluttering near flowers, petals drifting from cherry trees, fish shadows gliding in ponds. Purely client-side and cosmetic; they need not be synchronized between players. Use CC0 art only (decision-1).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Butterflies appear near flower patches and wander without leaving the screen
- [x] #2 Cherry trees occasionally shed drifting petals
- [x] #3 Ponds and lakes occasionally show a gliding fish shadow
- [x] #4 Effects are deterministic per screen in density so busy screens stay readable
- [x] #5 Disabled or reduced when the user prefers reduced motion
- [x] #6 Any new art is CC0 and listed in SOURCES.md
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Shared animation layer built once per screen (art/scene.ts), drawn by the game renderer and the art gallery. All motion is a pure function of (screen, world position, clock), so every player sees the same thing and it is unit-testable. A live prefers-reduced-motion flag freezes the clock and hides critters. Evidence: gallery section rendering the same screens at several clock values, screenshots, plus unit tests.
Butterflies: small in-code 2-frame sprite, count from the screen's flower tiles (capped), bounded lissajous paths around a home flower. Petals: pack LeafPink 6-frame tumble, emitted on staggered timers from cherry trees, falling with the wind. Fish: pack fish as a dark silhouette gliding in straight runs along rows or columns of interior water, rotated only in 90-degree steps to stay crisp.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shared scene layer: art/scene.ts (build once per screen, draw per frame), art/wind.ts (gust, sway slices), art/life.ts (water twinkle, butterflies, fish, petals). Motion uses wall-clock time so players on the same screen see roughly the same thing. Gallery section /art.html?section=motion renders fixed clock values for review.
Measured in Chrome (4x scale): draw per frame 0.11 ms all-water, 1.14 ms for 300 swaying trees and grass, 0.27 ms garden. Scene build about 90 ms per screen, almost all the pre-existing terrain bake.
e2e/ambience.spec.ts: the garden canvas changes over 700 ms with motion; with prefers-reduced-motion it is pixel-identical. Playwright now runs one worker so other tests' players can't wander into these frames.
Butterflies: in-code 7x5 two-frame sprite (original, no external art), four wing colours, count ceil(flowers/8) capped at 3, bounded wander around a home flower; tests sample 10 minutes and assert on screen. First pass at 5x4 was too small to see and was enlarged with an outline.
Petals: pack FX/Particle/LeafPink.png, 2 per cherry tree on staggered 5 s timers, falling from the canopy's lower edge, drifting further in gusts, fading out.
Fish: pack Actor/Animal/Fish/SpriteSheetWhite.png top-down frame as a dark silhouette at 45% opacity, rotated only in 90-degree steps, gliding along straight runs of 4+ open-water tiles, at most 2 per screen, visible about half the time; tests assert it only ever sits over open water.
New pack files (Plant, LeafPink, Fish) are CC0 and listed in SOURCES.md; the sources test enforces it.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Screens now have butterflies near flowers, petals drifting from cherry trees, and fish shadows gliding in lakes, all deterministic per screen, capped for readability, CC0, and off under reduced motion. Verified with unit tests over long time samples, gallery review, and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
