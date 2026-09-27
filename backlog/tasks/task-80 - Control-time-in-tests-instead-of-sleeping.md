---
id: TASK-80
title: Control time in tests instead of sleeping
status: To Do
assignee: []
created_date: '2026-09-27 15:54'
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
- [ ] #1 No e2e spec waits in real time for a session timeout, an idle close, or a rate-limit window
- [ ] #2 A test can advance the server clock only through an explicit test setting that production cannot enable
- [ ] #3 The wake spec passes 20 times in a row with `--repeat-each 20` and takes less than half its current time
<!-- AC:END -->
