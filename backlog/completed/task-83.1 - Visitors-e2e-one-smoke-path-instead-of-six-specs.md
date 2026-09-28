---
id: TASK-83.1
title: 'Visitors e2e: one smoke path instead of six specs'
status: Done
assignee:
  - '@claude'
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
priority: high
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rows 25 to 30 of the E2E coverage map. `e2e/visitors.spec.ts` has six tests (about 53 s), and the portal test fails intermittently. Every server behaviour they check is already covered in `apps/server/src/play.test.ts` and `host.test.ts`. The browser still needs one path through the Friends dialog, the visit, and going home.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The portal, reload-while-visiting and logout-sends-visitors-home tests are removed
- [x] #2 One visitor smoke covers opening the world, a refused code alert, arriving with the arrival hint, Go home back to /, and the notice after the host closes the world
- [x] #3 `e2e/visitors.spec.ts` passes with `--repeat-each 10`
- [x] #4 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Delete the portal, reload-while-visiting and logout tests from e2e/visitors.spec.ts (covered in play.test.ts and web portal/state tests per doc-6).
2. Fold the refused-code alert and the closed-world notice into the friend-joins test so one smoke covers the browser path.
3. Verify with --repeat-each 10 and the full suite; list removed assert -> covering test in the PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
visitors.spec.ts 6 tests (54 s) -> 1 smoke (11.5 s). --repeat-each 10: 10/10. Full e2e 34 passed in 2.4 min. Every removed assertion's covering test was opened and read; table in PR #14. Kept a depart-portal-before-leaving check (mutation-tested against game.ts). Gap: game.ts frame loop freezing a visitor during the arrival portal has no test; added as an AC on TASK-83.4. PR https://github.com/geekitycom/explore/pull/14
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Visitors e2e is one smoke path (refused code alert, arrival hint, Go home with its portal, sent home on close) instead of six tests; the flaky portal test is gone. Removed assertions are all covered by server or web tests, listed in PR #14. Verified with --repeat-each 10 and the full e2e suite.
<!-- SECTION:FINAL_SUMMARY:END -->
