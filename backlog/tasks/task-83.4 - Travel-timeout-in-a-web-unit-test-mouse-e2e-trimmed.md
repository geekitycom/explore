---
id: TASK-83.4
title: Travel timeout in a web unit test; mouse e2e trimmed
status: To Do
assignee: []
created_date: '2026-09-27 19:13'
updated_date: '2026-09-27 19:24'
labels:
  - e2e
  - test-reliability
milestone: m-6
dependencies: []
documentation:
  - backlog/docs/doc-6 - E2E-coverage-map.md
parent_task_id: TASK-83
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rows 20 and 37 of the E2E coverage map. `world.spec.ts` "a travel the server never answers returns you to play" (9 s) tests client logic, the `TRAVEL_TIMEOUT_MS` check in `apps/web/src/game/game.ts`, and nothing else covers it. `mouse.spec.ts` pond test (12 s) repeats routing covered by core and web unit tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A web unit test shows a travel with no answer returns the player to play where they stood after the timeout, and not before
- [ ] #2 The world travel-timeout e2e test is removed
- [ ] #3 The mouse pond test keeps only a double-click off the east edge that crosses screens with no server corrections
- [ ] #4 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
- [ ] #5 A unit test shows held keys do not move a visitor until their arrival portal lets them out (the youCanMove check in the game.ts frame loop)
<!-- AC:END -->
