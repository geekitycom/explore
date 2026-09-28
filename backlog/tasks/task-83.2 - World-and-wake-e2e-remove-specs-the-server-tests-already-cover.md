---
id: TASK-83.2
title: 'World and wake e2e: remove specs the server tests already cover'
status: To Do
assignee: []
created_date: '2026-09-27 19:13'
updated_date: '2026-09-27 19:13'
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
- [ ] #1 wake: reloading within the timeout and coming back after the timeout are removed
- [ ] #2 world: two players see each other walk and walking off an edge are removed
- [ ] #3 The remaining wake tests still pass
- [ ] #4 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
<!-- AC:END -->
