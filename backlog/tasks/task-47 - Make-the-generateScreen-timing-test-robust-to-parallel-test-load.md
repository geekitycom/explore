---
id: TASK-47
title: Make the generateScreen timing test robust to parallel test load
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-25 17:08'
updated_date: '2026-09-25 18:11'
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
- [ ] #1 The timing test passes reliably on CI while the full suite runs in parallel
- [ ] #2 The test still fails when screen generation is made meaningfully slower
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Keep the budget as it is (mean of 200 cold screens under 10 ms): a median or min over batches would measure cheaper terrain, since batch cost varies with content far more than with noise.
2. Remove parallel load by construction: move the test to generate.perf.test.ts, exclude *.perf.test.ts from the main vitest run, and run it alone afterwards in pnpm test.
3. Prove it fails when generation is slower (a busy wait in generateScreen), then read the isolated duration on CI and compare with the in-suite 1930 to 1990 ms.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Evidence before changing anything: on CI the test took 1930, 1986 and 1990 ms for 200 screens on the last three main runs (9.7 to 9.95 ms per screen) and 2169 ms (10.82) on the failed attempt; a day earlier it took 414 to 750 ms. Every generation-heavy test in generate.test.ts runs about 2.2x slower on CI than locally in the full suite (for example 2358 vs 1043 ms), and the timing test is 1.9x (1930 vs 1029 ms), so its slowness on CI is steady, not a burst. Locally the test measures about 5 ms per screen both alone and in the full suite. Batches of 40 screens vary 3.6 to 5.3 ms by terrain but only about 2% run to run, and fresh seeds vary 4.2 to 6.1 ms, so a min over seeds or chunks would measure cheaper terrain rather than filter noise. Under 20 extra CPU burners the wall-clock and process CPU time both inflate (18 and 8 ms), so no in-process statistic removes steady contention.

Implemented: generate.perf.test.ts holds the test unchanged; pnpm test runs vitest with --exclude **/*.perf.test.ts, then vitest run perf.test alone. Locally: 444 tests then 1, all pass. With a 6 ms busy wait in generateScreen it failed at 10.0 ms (2003 ms for 200); with 8 ms it failed with "expected 12.025 to be less than 10". Locally the budget is about 2x the current 5 ms cost, so it catches regressions around a doubling here, and smaller ones on slower CI hardware.

Not landed: commit signing through 1Password was locked for 45 minutes, so the change is staged but uncommitted in this worktree. Still to do after commit and push: read the isolated duration of the perf test on CI. If it is still near 10 ms, the budget is spent on CI hardware and the fix is a generation speed-up or a budget decision, not the test.
<!-- SECTION:NOTES:END -->
