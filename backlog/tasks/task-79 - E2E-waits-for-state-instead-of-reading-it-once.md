---
id: TASK-79
title: E2E waits for state instead of reading it once
status: To Do
assignee: []
created_date: '2026-09-27 15:54'
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
- [ ] #1 Every e2e assertion on state that arrives asynchronously uses `expect.poll` or a web-first locator assertion
- [ ] #2 `waitForTimeout` remains only where a spec asserts that something does not change over a period, and each remaining use says so in its assertion message
- [ ] #3 The traces spec passes 20 times in a row with `--repeat-each 20`
<!-- AC:END -->
