---
id: TASK-83.6
title: 'Landmark, map and HUD e2e trimmed, smoke paths written down'
status: To Do
assignee: []
created_date: '2026-09-27 19:13'
updated_date: '2026-09-27 19:13'
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
- [ ] #1 Landmarks keep one dialog path with one failed suggestion; the seven-press loop and the map check are gone
- [ ] #2 Map specs drop the visited-screen checks and the 500-screen injection; traces drops the hint timing loop
- [ ] #3 The e2e folder or doc-1 lists each remaining smoke path with the reason it needs a browser
- [ ] #4 The full e2e suite runs in under half of its 182 s test time
- [ ] #5 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
<!-- AC:END -->
