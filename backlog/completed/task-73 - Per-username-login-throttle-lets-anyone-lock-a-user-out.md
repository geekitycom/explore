---
id: TASK-73
title: Per-username login throttle lets anyone lock a user out
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 14:12'
updated_date: '2026-09-27 16:06'
labels:
  - server
  - security
  - auth
dependencies: []
references:
  - apps/server/src/app.ts
  - apps/server/src/rate-limit.ts
priority: high
type: bug
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In `/api/login` (`apps/server/src/app.ts`), the per-username limiter is checked and incremented before `verifyPassword`. Ten wrong attempts against a username from anywhere make even the correct password return 429 for 15 minutes. It resets only on a successful login, which the throttle now blocks, so an attacker can keep any account locked out indefinitely for 10 requests per 15 minutes.

Found by the multi-model architecture review (2026-09-27), Opus reviewer; confirmed against source.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Wrong passwords from other clients cannot stop a user who has the right password from logging in
- [x] #2 Repeated wrong guesses against one username are still rate limited
- [x] #3 Tests cover a lockout attempt followed by a login with the correct password, and a guessing run that gets throttled
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Replace the per-username lockout test with two tests: ten wrong guesses from other addresses leave the owner's correct login working, and a guessing run from one address against one username is throttled until the window passes (while the same username from another address still works).
2. Key the failed-login limiter on address plus username instead of username alone, keeping the check-and-hit before verifyPassword so parallel bursts count, the per-address limit, and the decoy hash path unchanged.
3. Gates: lint, format:check, typecheck, test.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Keyed the failed-login limiter on address plus username. PR https://github.com/geekitycom/explore/pull/3 (fix/task-73-login-throttle @ 3cd2662). Red: expected 429 to be 200. Gates green.

Added refactor commit 7e13b8c (key renamed addressAndUsername, comment dropped per no-comments).

Verified: "lets the owner log in after other addresses fail against their username" was red (Expected 200, Received 429) and is green; the one-address guessing run is throttled; the reset-on-success test fails if reset is removed. Tradeoff: guesses spread across many addresses are capped per address, not per username.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Failed logins are now counted per client address plus username, so failures from elsewhere cannot lock the owner out while one address guessing is still throttled. Checked before verifyPassword to avoid a password oracle. Verified with red-then-green app tests; merged in PR #3.
<!-- SECTION:FINAL_SUMMARY:END -->
