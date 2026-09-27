---
id: TASK-82
title: Retry e2e once in CI and track flaky specs
status: To Do
assignee: []
created_date: '2026-09-27 15:54'
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
- [ ] #1 CI runs e2e with one retry, and local runs keep zero retries
- [ ] #2 Every CI run lists the specs that passed only on retry, in the job summary or an uploaded report
- [ ] #3 Each spec reported flaky has an M7 task until it stops appearing
<!-- AC:END -->
