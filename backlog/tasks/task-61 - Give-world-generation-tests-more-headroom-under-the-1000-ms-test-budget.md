---
id: TASK-61
title: Give world-generation tests more headroom under the 1000 ms test budget
status: To Do
assignee: []
created_date: '2026-09-26 13:51'
labels:
  - testing
dependencies: []
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After TASK-57 every unit test is under 1000 ms, but on the arm64 CI runner the world-generation tests sit at 500-670 ms (generate.test lakes/forests 671, reach tests 520-532, river seams north 590; CI run 36245904783), and generate.test.ts alone takes about 14 s. Most of it is generating screens (about 1 ms each on the Mac) and cold per-seed fields. Cut the cost further so the budget cannot flake on a slower runner, without weakening what each test catches.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No unit test exceeds 400 ms on the arm64 CI check job
- [ ] #2 Each changed test still fails on the defect it guards, checked by injecting it
<!-- AC:END -->
