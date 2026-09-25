---
id: TASK-11
title: Rate-limit login and signup
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 23:22'
updated_date: '2026-09-25 13:40'
labels: []
milestone: m-1
dependencies: []
priority: high
type: enhancement
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
POST /api/login and /api/signup accept unlimited attempts, which allows password guessing and account spam. Add throttling at the server boundary. Single-node in-memory state is acceptable per decision-2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Repeated failed logins for one username are throttled and return 429 with a Retry-After header
- [x] #2 Repeated signups or logins from one client address are throttled
- [x] #3 A successful login is not blocked by other users' failures
- [x] #4 The web client shows the throttle message inline
- [x] #5 Integration tests cover limits, reset after the window, and the 429 shape
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add an in-memory fixed-window limiter (apps/server/src/rate-limit.ts) keyed by string, with lazy sweeping of expired windows.
2. In createApp, throttle /api/signup and /api/login per TCP peer address (getConnInfo), and failed logins per lowercased username; answer 429 rate_limited with Retry-After seconds.
3. Count a login attempt against the username before verifying (race-safe under parallel requests) and reset it on success.
4. Integration tests with fake Date: limits, 429 shape, recovery after the window, other users unaffected; e2e test for the inline web message.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Defaults chosen: 20 signups/hour/address, 30 logins/15 min/address, 10 failed logins/15 min/username (AUTH_LIMITS). Address is the TCP peer; X-Forwarded-For is not trusted (spoofable), follow-up TASK-40 covers running behind a proxy.
The web client already renders field-less API errors in .form-error, so no web change was needed; e2e 'a throttled login shows the wait inline' proves it.
Tests pass a fake connection env to app.request so getConnInfo works without a socket.
Mutation-checked: removing the username throttle, the reset, the Retry-After header, the signup throttle, or the window-expiry check each fails a test.
Validation: pnpm lint, typecheck, format:check, test (184 passed), e2e (9 passed).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Login and signup are now throttled at the server boundary with in-memory fixed windows: per client address for both endpoints and per username for failed logins. Throttled requests get 429 {error:{code:'rate_limited',message}} with Retry-After, and the web login form shows the message inline. Verified with app.test.ts rate-limit tests (limits, 429 shape, recovery after the window, other users unaffected), rate-limit.test.ts, and the e2e suite including a new throttled-login test.
<!-- SECTION:FINAL_SUMMARY:END -->
