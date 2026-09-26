---
id: TASK-57
title: Keep every unit test fast and fail the suite on slow ones
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 12:59'
updated_date: '2026-09-26 13:39'
labels:
  - testing
dependencies: []
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tests time out at vitest's 5000 ms default on slower or busier machines (GitHub CI runners, a laptop running Ollama or the dev server). The cause is expensive test bodies: real HTTP plus scrypt hashing repeated in rate-limit tests, exhaustive seed x species loops, regenerating road networks and regions per case. Make each slow test cheap while keeping its power to catch the defect it guards, and add a structural budget so a slow test fails the suite.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every unit test (excluding *.perf.test.ts) runs under ~300 ms on the M-series Mac
- [x] #2 Each changed test still fails when the defect it guards against is injected
- [x] #3 No test timeout is raised and no test is moved to the perf pass unless it is a timing measurement
- [x] #4 A unit test slower than 1000 ms fails pnpm test locally and in CI with a message naming the test
- [x] #5 The README testing section documents the per-test budget
- [x] #6 pnpm test total is measurably faster; before/after totals and top 10 recorded in notes
- [x] #7 Suite passes repeatedly, including under CPU contention, with no test near the budget
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Measure every test with the JSON reporter; profile the slow ones.
2. Fix each cause while keeping the test's power: inject a low scrypt cost in server tests, poll epitaph writes every ms, stop per-pixel expects and deep toEqual on screens, compare road plans against 3x3 neighbourhoods, sample seeds and screens deterministically, split big loops into test.each cases, speed up edgeDistance with identical output.
3. For each changed test, inject its defect into the code and run old and new tests (scratchpad mutate.mjs).
4. Add vitest.setup.ts that fails any non-perf unit test over 1000 ms; list projects inline so they inherit it; document in README Testing.
5. Run the suite calm x3 and under 6 busy loops; lint, typecheck, format; land on main and check CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured on the M-series Mac, full parallel unit run (JSON reporter):
- Before: 751 tests, 58.6 s summed, 58 tests over 300 ms, slowest 1677 ms (rate limits), unit wall 18.7 s; pnpm test 21.2 s.
- After: 882 tests (splits add cases), 27.8 s summed, 5-10 over 300 ms, slowest 386-465 ms across three calm runs, unit wall 10.4 s; pnpm test 11.5-11.8 s.
- Under 6 busy loops (yes > /dev/null) the slowest test was 636-676 ms, under the 1000 ms budget. The remaining 300-470 ms tests (river seams north half, never shut land, meadow and forest palettes) take 100-190 ms alone; the rest is contention from the parallel run.
- Causes: scrypt at production cost per login (inject scryptCost); vi.waitFor 50 ms polling; per-pixel expect calls and deep toEqual on 300k-byte screens; a 256-screen road plan whose road() scans every segment; fence test redrawing once per byte; exhaustive seeds x ramp swaps; 2 shuffled regenerations of 144 screens; 4-screen margins where 1 is needed.
- Every changed test was checked by injecting its defect (tool: scratchpad mutate.mjs applies an edit, runs vitest -t, restores). Old and new tests caught the same defects; a few injected defects were caught by neither, which is unchanged.
- Decision: project list moved inline with extends: true, because glob projects did not inherit the root setupFiles.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Unit tests now cost 27.8 s summed instead of 58.6 s, and pnpm test takes 11.5 s instead of 21.2 s on the M-series Mac. The slowest test in a full parallel run is 386-465 ms (was 1677 ms), and 636-676 ms under six busy loops. Causes fixed: scrypt at production cost in server tests (new createApp scryptCost), 50 ms vi.waitFor polling, per-pixel expect and deep toEqual, a 256-screen road plan, per-byte fence redraws, and exhaustive seed and screen loops (now sampled or split). vitest.setup.ts fails any non-perf unit test over 1000 ms and names it; the README Testing section documents the rule. Each changed test was checked against injected defects, old and new. AC #1 is left unchecked: every test is under 190 ms alone, but 5-10 still reach 300-470 ms in the parallel run.
<!-- SECTION:FINAL_SUMMARY:END -->
