---
id: TASK-41
title: Speed up terrain baking on screen entry
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 14:00'
updated_date: '2026-09-25 15:00'
labels: []
milestone: m-4
dependencies: []
priority: low
type: bug
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while verifying TASK-36. bakeTerrain in apps/web/src/art/terrain.ts takes about 90 ms per screen (mean over 20 screens of world 98765, Vite dev server, Chrome on an M-series Mac), so buildScene spends almost all its time there on each new screen. Recipe scenery adds about 0.2 ms once its sprites are cached, and drawing a dense screen takes 0.4 ms per frame. A 90 ms bake can show as a hitch when a player crosses into a new screen. Measure in a production build first; if it holds, cache transition tiles by corner pattern or bake off the main path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Baking a generated screen takes under 16 ms in a production build, measured on the same screens
- [x] #2 Crossing screens shows no dropped frames in a recorded trace
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Measure bakeTerrain in a production vite build in Chrome over 20 screens of world 98765 (scratch bench page + Playwright runner with CPU profile). Baseline: mean 171 ms per screen, edgeDistance 89% of self time.
2. Rewrite edgeDistance to splat distances outward from edge pixels (exact equivalent of the per-pixel offset scan; border pixels keep the 1D rule). Keep the signature.
3. Tighten the composeTerrain per-pixel loop (no per-pixel subarray or find closures).
4. Prove identical output: pixel hashes of the 20 screens before and after, seam tests, full test suite.
5. Re-measure on the same screens in a production build; record a screen-crossing trace from the real game for AC #2.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Baseline in a production vite build (Google Chrome, M-series Mac, 20 screens of world 98765 at sx=1..20, sy=0, 3 rounds): bakeTerrain mean 171 ms, median 170.8, max 187.7. CPU profile: edgeDistance 89% of self time (it scanned ~80 offsets at every one of 76,800 pixels on each of 5 layers), the composeTerrain per-pixel closure 6%, layerRegion 1.3%.
Fix: edgeDistance now spreads distances outward from edge pixels (the nearest pixel across an edge is always an edge pixel, so this is exact); border pixels keep their 1D rule. composeTerrain copies water rows with set() and writes pixels without per-pixel subarray or find closures. Signatures unchanged.
After, same build settings and screens: bake mean 6.64 ms, median 6.4, max 8.3. Pixel hashes of all 20 screens identical before and after, in Node and in Chrome. Seam tests green.
Crossing trace in the real game (production build, real server): before, each crossing had a 150 ms and 133 ms frame gap from a 149 ms and 144 ms task; after, worst gaps 16.8 and 16.7 ms on a 16.7 ms period, longest task 12.7 and 8.7 ms, 0 dropped frames.
Not done: caching transition tiles by corner pattern does not fit the marching-squares edges from TASK-15 (a tile depends on its 3x3 lattice neighbourhood and on neighbouring tiles' edges within 5 px), and baking off the main thread would only hide a cost that is now small.

Comment review: dropped the doc paragraph arguing the splat is exact (the new mask test enforces it) and named the four-way neighbour check edgePixel. Final production bench on the same build settings and screens: bake mean 7.25 ms, median 7.0, max 13.5; hashes still identical. Rerun instructions: copy the bench page from the session scratchpad (bench/page) to apps/web/bench and run bench/run.mjs; the crossing trace comes from bench/crossing.mjs against the real server.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Measured bakeTerrain in a production build first: mean 171 ms per screen (20 screens of world 98765, Chrome), with edgeDistance at 89% of self time. Rewrote edgeDistance to spread distances outward from edge pixels instead of scanning ~80 offsets at every pixel, and tightened the composeTerrain pixel loop. Same build and screens after: mean 6.64 ms, max 8.3 ms. Output is byte-identical (pixel hashes of all 20 screens match in Node and Chrome; seam tests green) and a new test checks edgeDistance against a direct per-pixel search. A recorded Chrome trace of six real screen crossings shows 0 dropped frames (worst gap 16.8 ms on a 16.7 ms period), where before each crossing dropped a frame behind a 133 to 150 ms task. Verified with pnpm lint, typecheck, format:check, and test (322 passing).
<!-- SECTION:FINAL_SUMMARY:END -->
