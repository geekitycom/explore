---
id: TASK-80
title: Control time in tests instead of sleeping
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 15:54'
updated_date: '2026-09-27 19:02'
labels:
  - e2e
  - server
  - test-reliability
milestone: m-6
dependencies: []
references:
  - e2e/wake.spec.ts
  - e2e/session.ts
  - apps/server/src/main.ts
  - playwright.config.ts
priority: medium
type: enhancement
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`e2e/wake.spec.ts` "coming back after the timeout wakes the player in the garden again" sleeps for `SESSION_TIMEOUT_MS + 1000` of real time. Long real waits are where CI timing jitter shows up: this spec failed on the CI runs for PR #3 and #6 with the player stuck in `waking`. The server already takes an injected `now()`, and Playwright offers `page.clock` for the browser.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No e2e spec waits in real time for a session timeout, an idle close, or a rate-limit window
- [x] #2 A test can advance the server clock only through an explicit test setting that production cannot enable
- [x] #3 The wake spec passes 20 times in a row with `--repeat-each 20` and takes less than half its current time
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Test hook to advance the server's injected now(), behind the same test setting as TASK-78.
2. Wake spec advances server time (and page.clock where the client needs it) instead of sleeping; same for idle close and rate-limit windows.
3. Verify wake spec with --repeat-each 20 and under half its current time.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Wake spec advances the server clock via the clock hook instead of sleeping; waits for exploreState before reading (fixes CI 'exploreState is not a function'). e2e server now uses the production session timeout. wake --repeat-each 20: 80 passed. Target test 11.0s -> 2.7s; whole wake file 18.9s -> 10.6s, not under half, so AC #3 left unchecked pending a call on whether it means the test or the file. PR https://github.com/geekitycom/explore/pull/12

AC #3 read as the timeout test the task describes (11.0s -> 2.7s), confirmed with the user; the rest of wake.spec.ts watches real animations and never slept for a timeout, so trimming it belongs to TASK-83.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The wake spec moves the server clock past the session timeout through a test hook instead of sleeping, and waits for the app before reading state. The clock hook is opt-in and unavailable in production. Verified with wake --repeat-each 20 (80 passed), the timeout test dropping from 11.0s to 2.7s, and a clean CI run on PR #12. PR https://github.com/geekitycom/explore/pull/12
<!-- SECTION:FINAL_SUMMARY:END -->
