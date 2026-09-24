---
id: TASK-11
title: Rate-limit login and signup
status: To Do
assignee: []
created_date: '2026-09-24 23:22'
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
- [ ] #1 Repeated failed logins for one username are throttled and return 429 with a Retry-After header
- [ ] #2 Repeated signups or logins from one client address are throttled
- [ ] #3 A successful login is not blocked by other users' failures
- [ ] #4 The web client shows the throttle message inline
- [ ] #5 Integration tests cover limits, reset after the window, and the 429 shape
<!-- AC:END -->
