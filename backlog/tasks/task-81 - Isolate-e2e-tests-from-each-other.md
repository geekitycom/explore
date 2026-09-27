---
id: TASK-81
title: Isolate e2e tests from each other
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
  - playwright.config.ts
  - apps/server/src/rate-limit.ts
  - e2e/auth.spec.ts
priority: medium
type: enhancement
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
All specs share one server, one data directory and the in-memory rate limiters, and every request comes from the same address. `e2e/auth.spec.ts` "a throttled login shows the wait inline" fails under `--repeat-each` because earlier runs used up the per-address login limit. Failures that depend on test order or repetition make a red run unreadable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each e2e test starts with no rate-limit history from earlier tests
- [ ] #2 The whole e2e suite passes with `--repeat-each 3`
- [ ] #3 No test relies on accounts, worlds or visitor codes another test created
<!-- AC:END -->
