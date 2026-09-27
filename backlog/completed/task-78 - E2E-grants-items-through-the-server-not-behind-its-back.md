---
id: TASK-78
title: 'E2E grants items through the server, not behind its back'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 15:54'
updated_date: '2026-09-27 18:46'
labels:
  - e2e
  - test-reliability
milestone: m-6
dependencies: []
references:
  - e2e/cairn.spec.ts
  - e2e/touch.spec.ts
  - e2e/helpers.ts
priority: high
type: bug
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`e2e/cairn.spec.ts` `give` writes the inventory straight into the world SQLite file and then reloads the page. The server saves the old socket's player state on disconnect, and that save can land after the test's write and overwrite it. That matches the failure "Expected: 4, Received: 3" in the cairn spec, seen on main (CI run 36270304597) and locally on the TASK-70 to 74 stack. Any other spec that seeds state by writing a database file while the server runs has the same race; the iPad touch spec also fails intermittently on main and should be checked for it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No e2e spec writes a world or main database file while the server is running
- [x] #2 Specs that need items or other seeded state get it through the server's own write path, such as a test-only route or socket message
- [x] #3 The test-only path is off unless an explicit test setting enables it, and a production build cannot enable it
- [x] #4 The cairn spec passes 20 times in a row with `--repeat-each 20`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. One test-hooks surface on the server, enabled only by an explicit test setting that production cannot enable (shared with TASK-80, TASK-81).
2. A grant-items hook through the server's own player write path; migrate cairn and touch specs off direct DB writes.
3. Verify cairn spec with --repeat-each 20.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Test hooks at POST /api/test/:name (typed table: inventory, place, clock, rate-limits), on only with EXPLORE_TEST_HOOKS=1; settings.ts refuses other values and NODE_ENV=production; main.ts dynamic-imports the module; Dockerfile deletes it (docker smoke passes). e2e worldDb/mainDb open readOnly. Premise correction: cairn 4-vs-3 still failed 3/20 with server-side grants; the grant's inventory message arrived ~10ms before Digit1 and keys act on the last drawn frame. Spec now waits for the bar to show the stones; 20/20 after. PR https://github.com/geekitycom/explore/pull/12
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
e2e seeds items and positions through server test hooks that write via the live game, so disconnect saves cannot overwrite them; hooks are opt-in and structurally unavailable in production. No spec writes a database while the server runs. Verified: cairn --repeat-each 20 all passed, hook-survives-disconnect unit test, settings guard tests, docker smoke. PR https://github.com/geekitycom/explore/pull/12
<!-- SECTION:FINAL_SUMMARY:END -->
