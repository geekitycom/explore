---
id: TASK-83
title: >-
  Move behaviour coverage into server integration tests and slim e2e to smoke
  paths
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-27 15:54'
updated_date: '2026-09-27 19:07'
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
- [ ] #1 Each behaviour an e2e spec checks today is covered by a server or unit test, or the spec is listed as a browser-only smoke path with the reason
- [ ] #2 E2E keeps a short list of smoke paths, written down in the e2e folder or doc-1 Architecture
- [ ] #3 The full e2e suite runs in under half its current time
- [ ] #4 No behaviour loses coverage: each removed e2e assertion names the test that now covers it in the PR description
<!-- AC:END -->
