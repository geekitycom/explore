---
id: TASK-83.3
title: Cairn behaviour in a server test instead of e2e
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
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Row 12 of the E2E coverage map. `e2e/cairn.spec.ts` is the only test that sends stone use and interact through the game; core `rock.test.ts` covers the rules but not the game path or the broadcast.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A server test puts down, picks up and stacks six stones into a cairn through the game, and a second player on the screen sees each change
- [ ] #2 The server test checks pockets are spent and refilled in order and that a stone in a cairn cannot be picked up
- [ ] #3 `e2e/cairn.spec.ts` is removed
- [ ] #4 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
<!-- AC:END -->
