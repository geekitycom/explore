---
id: TASK-78
title: 'E2E grants items through the server, not behind its back'
status: To Do
assignee: []
created_date: '2026-09-27 15:54'
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
- [ ] #1 No e2e spec writes a world or main database file while the server is running
- [ ] #2 Specs that need items or other seeded state get it through the server's own write path, such as a test-only route or socket message
- [ ] #3 The test-only path is off unless an explicit test setting enables it, and a production build cannot enable it
- [ ] #4 The cairn spec passes 20 times in a row with `--repeat-each 20`
<!-- AC:END -->
