---
id: TASK-86
title: >-
  play.test "keeps players on different layers apart" fails for about 1 seed in
  100
status: Done
assignee:
  - '@claude'
created_date: '2026-09-28 02:05'
updated_date: '2026-09-28 02:33'
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
- [x] #1 The failure is reproduced (for example under CPU load or with --repeat-each) and its cause named
- [x] #2 The test passes 50 times in a row under the same load
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Not load: the world seed is random, and about 1 seed in 100 puts a landmark signpost on bob's path through the cellar copy of the garden (seeds 154, 165, 272, 314, 372, 476 of 500), so the server corrects the move. Seed 154 pinned reproduces CI's 'expected correct to be screen'. Fix pins seed 1 and stores the east screens. 50/50 runs of play.test.ts under 20 CPU-bound processes. PR https://github.com/geekitycom/explore/pull/20
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The layers test pins its world seed so no landmark signpost can land on the walk through its cellar copy of the garden, which the server rightly corrected for about 1 seed in 100. Verified by reproducing CI's error with seed 154, and 50 clean runs under heavy load. PR #20.
<!-- SECTION:FINAL_SUMMARY:END -->
