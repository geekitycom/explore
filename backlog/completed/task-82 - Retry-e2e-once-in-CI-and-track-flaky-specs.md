---
id: TASK-82
title: Retry e2e once in CI and track flaky specs
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 15:54'
updated_date: '2026-09-27 18:46'
labels:
  - ci
  - e2e
  - test-reliability
milestone: m-6
dependencies: []
references:
  - .github/workflows/ci.yml
  - playwright.config.ts
priority: medium
type: chore
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A stopgap while the causes are fixed. About four in ten recent CI runs on main failed e2e on unrelated specs (cairn, iPad touch, visitors portal, wake). One Playwright retry in CI keeps main meaningful, and the flaky report shows which specs still need a real fix. Retries hide flakiness rather than remove it, so every spec reported flaky is a bug to file under M7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CI runs e2e with one retry, and local runs keep zero retries
- [x] #2 Every CI run lists the specs that passed only on retry, in the job summary or an uploaded report
- [x] #3 Each spec reported flaky has an M7 task until it stops appearing
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. playwright.config: retries 1 when CI, 0 locally.
2. CI lists specs that passed only on retry in the job summary.
3. File an M7 task for any spec reported flaky.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
retries: CI ? 1 : 0 in playwright.config.ts; e2e/flaky-reporter.ts writes specs that passed only on retry to $GITHUB_STEP_SUMMARY (probed with a throwaway flip-once spec: counted as flaky with CI=1, failed without). No new flaky spec surfaced on this branch, so #3 needs no task yet. PR https://github.com/geekitycom/explore/pull/12
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
CI retries e2e once, local runs keep zero retries, and a custom reporter lists every spec a retry saved in the job summary. Verified with a throwaway flaky spec under CI=1 and without. PR https://github.com/geekitycom/explore/pull/12
<!-- SECTION:FINAL_SUMMARY:END -->
