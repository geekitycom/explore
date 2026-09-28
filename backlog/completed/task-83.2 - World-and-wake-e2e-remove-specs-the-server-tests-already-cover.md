---
id: TASK-83.2
title: 'World and wake e2e: remove specs the server tests already cover'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 19:13'
updated_date: '2026-09-28 01:50'
labels:
  - e2e
  - test-reliability
milestone: m-6
dependencies: []
documentation:
  - backlog/docs/doc-6 - E2E-coverage-map.md
parent_task_id: TASK-83
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rows 32, 33, 35 and 36 of the E2E coverage map. `wake.spec.ts` resume and timeout tests and `world.spec.ts` presence and edge-travel tests check only server behaviour that `play.test.ts` already covers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 wake: reloading within the timeout and coming back after the timeout are removed
- [x] #2 world: two players see each other walk and walking off an edge are removed
- [x] #3 The remaining wake tests still pass
- [x] #4 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Each cited server test read before removal; no gaps (core travel.test covers north/south edges). wake + mouse --repeat-each 5: 20/20. PR https://github.com/geekitycom/explore/pull/17
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed the wake resume/timeout and world presence/edge-travel e2e tests, all covered by play.test.ts, state.test.ts and core travel.test.ts. Verified by reading each covering test, repeat runs of the remaining wake spec, and the full e2e suite (29/29). PR #17.
<!-- SECTION:FINAL_SUMMARY:END -->
