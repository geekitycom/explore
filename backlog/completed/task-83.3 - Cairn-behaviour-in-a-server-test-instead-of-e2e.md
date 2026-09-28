---
id: TASK-83.3
title: Cairn behaviour in a server test instead of e2e
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 19:13'
updated_date: '2026-09-28 01:47'
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
- [x] #1 A server test puts down, picks up and stacks six stones into a cairn through the game, and a second player on the screen sees each change
- [x] #2 The server test checks pockets are spent and refilled in order and that a stone in a cairn cannot be picked up
- [x] #3 `e2e/cairn.spec.ts` is removed
- [x] #4 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
New play.test.ts test drives use/interact through the real server; mutation-checked (cairn pick-up allowed, broadcast only to actor, pick-up order) and 10/10 repeat runs. e2e/cairn.spec.ts removed; e2e 33/33. PR https://github.com/geekitycom/explore/pull/15
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Cairn stacking is covered by a play.test.ts server test (put, pick up, stack six with a refill, broadcast to a second player, pockets in order, cairn refuses pick-up) and the cairn e2e spec is removed. Verified with three mutations, 10 repeat runs, full unit and e2e suites.
<!-- SECTION:FINAL_SUMMARY:END -->
