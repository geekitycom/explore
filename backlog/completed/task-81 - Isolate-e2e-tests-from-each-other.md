---
id: TASK-81
title: Isolate e2e tests from each other
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 15:54'
updated_date: '2026-09-27 18:46'
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
- [x] #1 Each e2e test starts with no rate-limit history from earlier tests
- [x] #2 The whole e2e suite passes with `--repeat-each 3`
- [x] #3 No test relies on accounts, worlds or visitor codes another test created
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Test hook to reset rate-limit state; call it before each test from a shared fixture.
2. Remove cross-test reliance on shared accounts, worlds and codes.
3. Verify the whole suite with --repeat-each 3.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Auto fixture in e2e/test.ts clears rate limits before each test; lint rule forbids importing test/expect from @playwright/test in specs. auth --repeat-each 5: 35 passed (429s with fixture disabled). Full suite --repeat-each 3: 117 passed in 9:06. No cross-test reliance found; Date.now-only usernames switched to unique(). PR https://github.com/geekitycom/explore/pull/12
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every e2e test starts with cleared rate limits through a shared auto fixture enforced by lint. Verified with auth --repeat-each 5 and the full suite --repeat-each 3 (117 passed). PR https://github.com/geekitycom/explore/pull/12
<!-- SECTION:FINAL_SUMMARY:END -->
