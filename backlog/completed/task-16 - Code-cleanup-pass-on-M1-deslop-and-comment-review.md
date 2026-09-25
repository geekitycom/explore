---
id: TASK-16
title: Code cleanup pass on M1 (deslop and comment review)
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 23:22'
updated_date: '2026-09-25 20:18'
labels: []
milestone: m-1
dependencies: []
priority: low
type: chore
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The M1 build skipped a final slop cleanup and comment review. Sweep the codebase for redundant code, over-abstraction, and comments that restate code, without changing behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No behavior change: all unit, integration, and e2e tests pass unchanged
- [x] #2 Comments that restate the code are removed; comments explaining a non-obvious why remain
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pin behavior: hash screens, biome samples, roads (scratchpad fingerprint/params/network scripts) and time the perf test before any edit.
2. Find dead exports with a script that counts each export's uses outside its file.
3. Sweep four areas in parallel worktrees (core generation, core recipes/flora/palette/scripts, server, web): remove dead code, one-caller wrappers, over-abstraction, and comments that restate code; keep comments that explain a non-obvious why.
4. Review each area diff, re-run fingerprints (must be byte-identical), lint, typecheck, tests, format, perf.
5. Land one commit per area, run e2e, push to main, confirm CI green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Swept four areas in parallel worktrees, one commit each, plus a final comment review.
- core scripts/art: render-preview reuses png.ts's encoder (preview PNG bytes unchanged, cmp); 7 script exports unexported; one stale doc comment. +33/-43.
- server: 5 file-local types unexported, WipeResult inlined, 3 restating doc comments, one redundant annotation. +8/-13.
- web: 15 exports unexported; dead 'loading' view, AudioEngine.dispose, synth loopSec, keyboard target param, startGame onScreen default; auth reads its inputs directly; e2e sign-up/playing/unique helpers shared in e2e/helpers.ts. +68/-99.
- core generation: deleted unused warped, terrainFromCode, featureFromCode, playerViewSchema, isOffScreen, tileCenter; 12 exports unexported; generate.ts uses world.ts tileCorners/inScreen instead of private copies; testing.ts uses cornerIndex/tileIndex. +24/-78.
- A first comment-sicko pass deleted 600 comment lines including decision references and why-comments (D22, D23, scrypt timing, lake connectivity); rejected and reverted. The rerun under the keep-the-why rule removed 3 restating comments.
Validation: screen/stitch/crossing, biome-sample and road-network sha256 fingerprints identical before and after (3840 7682c7fc..., 1d2ea05c..., 758 87e78537...); bench alternating base/after 1.65-1.9 ms/screen both; lint, typecheck, format:check, 461 unit tests + perf test, e2e 11/11 pass.
Follow-up: TASK-49 (shared close code and clamp).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Behavior-preserving cleanup across core, scripts, server and web: removed dead exports and unused functions, collapsed duplicated helpers (PNG encoder, tile corners, bounds check, e2e sign-up), and dropped comments that restate code while keeping every why-comment. Net -150 lines over 5 commits. Verified by byte-identical generator fingerprints (screens with stitching, biome samples, roads), unchanged bench timings, and passing lint, typecheck, format, unit, perf and e2e suites.
<!-- SECTION:FINAL_SUMMARY:END -->
