---
id: TASK-83
title: >-
  Move behaviour coverage into server integration tests and slim e2e to smoke
  paths
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 15:54'
updated_date: '2026-09-28 02:05'
labels:
  - e2e
  - server
  - test-reliability
milestone: m-6
dependencies:
  - TASK-78
  - TASK-79
  - TASK-80
  - TASK-81
references:
  - apps/server/src/play.test.ts
  - apps/server/src/app.test.ts
  - e2e
priority: low
type: enhancement
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`apps/server/src/play.test.ts` and `app.test.ts` already drive the game through its real message handling with fake connections and an injected `now()`, and they ran 1017 tests with no flakes. Most of what the e2e specs check can be tested there without a browser: movement rules, traces and cairns, visitors and portals, session timeout and waking, login throttling. E2E should keep only what needs a real browser: rendering, touch input, the dialogs, audio unlocking. This is a larger piece of work; split it into subtasks per spec when it is picked up.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each behaviour an e2e spec checks today is covered by a server or unit test, or the spec is listed as a browser-only smoke path with the reason
- [x] #2 E2E keeps a short list of smoke paths, written down in the e2e folder or doc-1 Architecture
- [x] #3 The full e2e suite runs in under half its current time
- [x] #4 No behaviour loses coverage: each removed e2e assertion names the test that now covers it in the PR description
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Split into TASK-83.1 to 83.6 (PRs #14 to #18). Coverage map in doc-6; smoke paths in e2e/README.md. Suite 39 tests / ~182 s -> 23 tests / 78.6 s. Two client rules gained unit tests (beginFrame) and cairn gained a server test.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
E2E is down to 23 browser smoke paths (78.6 s summed, from about 182 s); every removed assertion names its covering server, core or web test in PRs #14 to #18, and e2e/README.md records why each remaining path needs a browser.
<!-- SECTION:FINAL_SUMMARY:END -->
