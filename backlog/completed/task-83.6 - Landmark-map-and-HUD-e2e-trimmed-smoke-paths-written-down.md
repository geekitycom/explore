---
id: TASK-83.6
title: 'Landmark, map and HUD e2e trimmed, smoke paths written down'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 19:13'
updated_date: '2026-09-28 02:05'
labels:
  - e2e
  - test-reliability
milestone: m-6
dependencies:
  - TASK-83.1
  - TASK-83.2
  - TASK-83.3
  - TASK-83.4
  - TASK-83.5
documentation:
  - backlog/docs/doc-6 - E2E-coverage-map.md
parent_task_id: TASK-83
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rows 14 to 16, 18 and 23 of the E2E coverage map, plus the list of browser-only smoke paths TASK-83 asks for.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Landmarks keep one dialog path with one failed suggestion; the seven-press loop and the map check are gone
- [x] #2 Map specs drop the visited-screen checks and the 500-screen injection; traces drops the hint timing loop
- [x] #3 The e2e folder or doc-1 lists each remaining smoke path with the reason it needs a browser
- [x] #4 The full e2e suite runs in under half of its 182 s test time
- [x] #5 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
- [x] #6 The landmark bubble check measures the real on-screen bubble box (spans the tile centre, within one tile), which the removed epitaph spec used to do
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Base on a merge of PRs #15, #16, #17 so the suite is in its final shape.
2. Landmarks: one dialog path with one failed suggestion; add the real on-screen bubble box check moved from the epitaph spec. Map: drop visited-screen checks and the 500-screen injection. Traces: drop the hint timing loop.
3. Write the smoke-path list with reasons in e2e/README.md.
4. Remove the clock test hook and e2e/session.ts pieces if nothing uses them.
5. Measure full-suite test time against the 182 s baseline; rebase onto main once the three PRs merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Suite measured on the rebased branch: 23 tests, 0 failed, 78.6 s summed (JSON reporter). Bubble box check fails on two bubbles.ts mutations. Clock hook and e2e/session.ts removed as unused. PR https://github.com/geekitycom/explore/pull/18
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Landmark, map and HUD e2e trimmed to browser paths, the on-screen bubble box check moved to the landmark spec, e2e/README.md lists each smoke path with its reason, and the unused clock hook is gone. Full e2e is 23 tests and 78.6 s summed, under half the 182 s baseline. PR #18.
<!-- SECTION:FINAL_SUMMARY:END -->
