---
id: TASK-79
title: E2E waits for state instead of reading it once
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 15:54'
updated_date: '2026-09-27 18:46'
labels:
  - e2e
  - test-reliability
milestone: m-6
dependencies: []
references:
  - e2e/traces.spec.ts
  - e2e/helpers.ts
priority: high
type: bug
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`e2e/traces.spec.ts` "the inventory bar and the hint bar frame the world" read the inventory slots once and got an empty list before the bar had rendered (expected ten empty slots, received `[]`). Any `waitForTimeout` followed by a single read, or a one-shot `page.evaluate` read of state that is still arriving, fails the same way. Most specs already use `expect.poll` or locator assertions; this task brings the rest in line.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every e2e assertion on state that arrives asynchronously uses `expect.poll` or a web-first locator assertion
- [x] #2 `waitForTimeout` remains only where a spec asserts that something does not change over a period, and each remaining use says so in its assertion message
- [x] #3 The traces spec passes 20 times in a row with `--repeat-each 20`
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Audit every e2e one-shot read and waitForTimeout; convert async-state reads to expect.poll or locator assertions.
2. Keep waitForTimeout only for 'nothing changes' checks, with an assertion message saying so.
3. Verify traces spec with --repeat-each 20.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
One-shot reads of async state converted to expect.poll/locator assertions; key holds last until the player moved; new standingStill helper before screenshots. Ten waitForTimeout remain, all 'does not change' checks with messages saying so. traces --repeat-each 20: 40 passed. PR https://github.com/geekitycom/explore/pull/12
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
e2e waits for asynchronously arriving state instead of reading it once; remaining fixed waits only assert that nothing changes. Verified with traces --repeat-each 20 (40 passed) and the full suite. PR https://github.com/geekitycom/explore/pull/12
<!-- SECTION:FINAL_SUMMARY:END -->
