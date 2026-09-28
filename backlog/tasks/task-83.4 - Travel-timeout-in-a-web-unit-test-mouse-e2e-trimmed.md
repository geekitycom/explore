---
id: TASK-83.4
title: Travel timeout in a web unit test; mouse e2e trimmed
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
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rows 20 and 37 of the E2E coverage map. `world.spec.ts` "a travel the server never answers returns you to play" (9 s) tests client logic, the `TRAVEL_TIMEOUT_MS` check in `apps/web/src/game/game.ts`, and nothing else covers it. `mouse.spec.ts` pond test (12 s) repeats routing covered by core and web unit tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A web unit test shows a travel with no answer returns the player to play where they stood after the timeout, and not before
- [x] #2 The world travel-timeout e2e test is removed
- [x] #3 The mouse pond test keeps only a double-click off the east edge that crosses screens with no server corrections
- [x] #4 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
- [x] #5 A unit test shows held keys do not move a visitor until their arrival portal lets them out (the youCanMove check in the game.ts frame loop)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
beginFrame(state, now, travelSince) in state.ts owns the travel timeout and whether you walk; game.ts calls it. Five mutations each fail one new test. Remaining gap: game.ts ignoring walks is browser-only. PR https://github.com/geekitycom/explore/pull/17
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The travel timeout and the arrival-portal hold are pure beginFrame logic with unit tests at the exact boundaries; the world travel-timeout e2e test is gone and the mouse pond test is a single double-click off the east edge. Verified with five mutations, repeat runs and the full suites. PR #17.
<!-- SECTION:FINAL_SUMMARY:END -->
