---
id: TASK-83.5
title: 'Auth, avatar and epitaph e2e trimmed to browser paths'
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
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rows 5 to 8, 10, 11 and 13 of the E2E coverage map. Signup, profile, validation and throttling rules are covered in `app.test.ts` and `play.test.ts`; epitaph speech and bubble placement in `epitaphs.test.ts`, core and web unit tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The throttled-login and epitaph e2e tests are removed
- [ ] #2 Signup and the returning avatar step are one test; renaming from the dialog and the game bar is one test on a single page
- [ ] #3 One field-error render remains
- [ ] #4 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
<!-- AC:END -->
