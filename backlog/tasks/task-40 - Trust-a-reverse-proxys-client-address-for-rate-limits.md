---
id: TASK-40
title: Trust a reverse proxy's client address for rate limits
status: To Do
assignee: []
created_date: '2026-09-25 13:40'
labels: []
milestone: m-1
dependencies: []
priority: low
type: enhancement
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Auth rate limits (TASK-11) key per-address buckets on the TCP peer address from @hono/node-server getConnInfo. Behind a reverse proxy every player shares the proxy's address, so 30 logins or 20 signups across all players would throttle everyone. When the deployment puts a proxy in front, add an opt-in setting (for example TRUST_PROXY) that reads the client address from X-Forwarded-For, taking the entry added by the trusted proxy rather than the spoofable leftmost one.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With the setting off, X-Forwarded-For is ignored for rate limits
- [ ] #2 With the setting on, per-address limits key on the client address the trusted proxy reports
- [ ] #3 Integration tests cover both modes
<!-- AC:END -->
