---
id: TASK-83.5
title: 'Auth, avatar and epitaph e2e trimmed to browser paths'
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
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Rows 5 to 8, 10, 11 and 13 of the E2E coverage map. Signup, profile, validation and throttling rules are covered in `app.test.ts` and `play.test.ts`; epitaph speech and bubble placement in `epitaphs.test.ts`, core and web unit tests.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The throttled-login and epitaph e2e tests are removed
- [x] #2 Signup and the returning avatar step are one test; renaming from the dialog and the game bar is one test on a single page
- [x] #3 One field-error render remains
- [x] #4 Every removed or trimmed e2e assertion names the test that now covers it in the PR description
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
auth+avatar+epitaphs 24.7 s -> 10.7 s. Three app breaks each fail one kept test. Gap: real on-screen bubble box check moved to TASK-83.6 as an AC. PR https://github.com/geekitycom/explore/pull/16
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Auth, avatar and epitaph e2e are trimmed to browser paths: one signup smoke, one field and one form error render, one single-page avatar dialog test; epitaph spec removed. Removed assertions map to server and unit tests in PR #16. Verified with three app breaks, repeat runs and the full e2e suite.
<!-- SECTION:FINAL_SUMMARY:END -->
