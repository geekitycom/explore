---
id: TASK-47
title: Make the generateScreen timing test robust to parallel test load
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 17:08'
updated_date: '2026-09-25 19:58'
labels: []
dependencies: []
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
generate.test.ts asserts a mean under 10 ms per screen by wall clock. That budget keeps movement from blocking on generation (the server prefetches one screen per event-loop turn). On CI run 36163363102 (commit df1a1cb) it measured 10.82 ms while other test workers ran in parallel, and passed on rerun. The test should measure in a way that parallel workers do not skew, and still fail when screen generation becomes meaningfully slower.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The timing test passes reliably on CI while the full suite runs in parallel
- [x] #2 The test still fails when screen generation is made meaningfully slower
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the budget as it is (mean of 200 cold screens under 10 ms): a median or min over batches would measure cheaper terrain, since batch cost varies with content far more than with noise.
2. Remove parallel load by construction: move the test to generate.perf.test.ts, exclude *.perf.test.ts from the main vitest run, and run it alone afterwards in pnpm test.
3. Prove it fails when generation is slower (a busy wait in generateScreen), then read the isolated duration on CI and compare with the in-suite 1930 to 1990 ms.

4. The isolated test still measured 10.77 ms on CI (run 36177721115), so the budget was spent: profile generateScreen and remove repeated work at its root, keeping every screen byte-identical (hash thousands of screens before and after), with no GENERATOR_VERSION bump and the budget unchanged.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence before changing anything: on CI the test took 1930, 1986 and 1990 ms for 200 screens on the last three main runs (9.7 to 9.95 ms per screen) and 2169 ms (10.82) on the failed attempt; a day earlier it took 414 to 750 ms. Every generation-heavy test in generate.test.ts runs about 2.2x slower on CI than locally in the full suite (for example 2358 vs 1043 ms), and the timing test is 1.9x (1930 vs 1029 ms), so its slowness on CI is steady, not a burst. Locally the test measures about 5 ms per screen both alone and in the full suite. Batches of 40 screens vary 3.6 to 5.3 ms by terrain but only about 2% run to run, and fresh seeds vary 4.2 to 6.1 ms, so a min over seeds or chunks would measure cheaper terrain rather than filter noise. Under 20 extra CPU burners the wall-clock and process CPU time both inflate (18 and 8 ms), so no in-process statistic removes steady contention.

Implemented: generate.perf.test.ts holds the test unchanged; pnpm test runs vitest with --exclude **/*.perf.test.ts, then vitest run perf.test alone. Locally: 444 tests then 1, all pass. With a 6 ms busy wait in generateScreen it failed at 10.0 ms (2003 ms for 200); with 8 ms it failed with "expected 12.025 to be less than 10". Locally the budget is about 2x the current 5 ms cost, so it catches regressions around a doubling here, and smaller ones on slower CI hardware.

Not landed: commit signing through 1Password was locked for 45 minutes, so the change is staged but uncommitted in this worktree. Still to do after commit and push: read the isolated duration of the perf test on CI. If it is still near 10 ms, the budget is spent on CI hardware and the fix is a generation speed-up or a budget decision, not the test.

Isolated on CI, run 36177721115 measured 10.77 ms per screen (2158 ms for 200), and runs 36177347176, 36177473690 and 36177624118 failed at 10.63 to 11.58, so isolation alone did not restore headroom. Profiling 600 screens locally: road routing about 35%, terrain 45% (water depth, biome), crossings re-evaluating terrain the corners had already computed about 28%.

Speed-up landed in a6f417a, 5188e3a, d94d6f0 and 90fea59, all output-preserving: per-screen terrain memo (crossings re-read corner terrain), 3x3 lake and river neighbourhood lists per cell instead of 18 nested-map hits per water lookup, lake basins skipped when they cannot reach the depth so far, road costs skip the river lookup on dry points, value noise hashes 4 corners and keeps the last cell's, biome sampling reuses its 25-site neighbourhood, blends params by index and takes Math.hypot only for sites within BAND of the nearest, and water depth below -FAR is only a bound (as it already was for rivers; no caller reads below -5.6). Proof of identity: 3840 screens and crossing sets over six seeds (including screens stitched to stored older neighbours), 210,000 biome samples, and 758 roads with their points of interest hash the same before and after, so GENERATOR_VERSION stays 5.

Local (M-series, bench of the perf test workload): 5.1 -> 1.7 ms per screen; vitest perf test 395 ms for 200. CI (2 vCPU AMD EPYC 9V74, perf test alone): before 10.63-11.58 ms (runs 36177347176, 36177473690, 36177624118, 36177721115, all failing); after 7.55-7.7 (a6f417a), 6.65-6.8 (03d67f2), 6.6 (d94d6f0), 4.16 and 6.43 (90fea59, run 36182237910 and its rerun). A throwaway CI profile (draft PR #2, closed) showed the same hot spots as locally and that runners vary: one round of the same code measured 12.5 ms under a noisy neighbour. The ~5 ms aim is met on some runners, not all; the next exact lever measured on CI is lazy param blending (about 9%), left out because it needs prototype getters behind a cast on the public BiomeSample.

With a 9 ms busy wait in generateScreen the unchanged test fails locally (expected 10.94 to be less than 10).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The generateScreen timing test (mean of 200 cold screens under 10 ms, budget unchanged) now runs alone after the suite, and screen generation is about 3x faster locally (5.1 -> 1.7 ms) and 1.7-2.5x faster on CI (10.6-11.6 ms, failing, -> 4.2-6.4 ms on the final commit), with byte-identical output (hashes of 3840 screens and crossings, 210,000 biome samples, 758 roads match; no GENERATOR_VERSION bump). CI is green on 90fea59 (run 36182237910 and rerun). The test still fails when generation slows: a 9 ms busy wait fails it at 10.94 ms.
<!-- SECTION:FINAL_SUMMARY:END -->
