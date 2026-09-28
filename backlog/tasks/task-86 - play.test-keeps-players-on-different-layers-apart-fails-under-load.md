---
id: TASK-86
title: play.test "keeps players on different layers apart" fails under load
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-28 02:05'
updated_date: '2026-09-28 02:06'
labels:
  - test-reliability
  - server
milestone: m-6
dependencies: []
priority: medium
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
apps/server/src/play.test.ts "world socket > keeps players on different layers apart, even at the same sx, sy" failed twice on 2026-09-27 during full `pnpm test` runs while other e2e suites were running on the same machine (TASK-83.6 work). It passed 20 of 20 alone and in five later full runs, so the cause is inferred to be timing under load, not reproduced. A flaky unit test makes a red check unreadable, as M7 exists to prevent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The failure is reproduced (for example under CPU load or with --repeat-each) and its cause named
- [ ] #2 The test passes 50 times in a row under the same load
<!-- AC:END -->
