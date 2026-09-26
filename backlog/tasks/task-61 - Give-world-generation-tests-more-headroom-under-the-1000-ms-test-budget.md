---
id: TASK-61
title: Give world-generation tests more headroom under the 1000 ms test budget
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-26 13:51'
updated_date: '2026-09-26 13:58'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pull per-test times from recent arm64 CI check logs (tests over 300 ms are printed) as the baseline.
2. generate.test: walk the region before generating margin screens, and generate margin screens only when the region alone leaves a screen unreached (same verdict); split the whatever-order regeneration into parts plus a seam check; compute each screen's crossings once; build the seed-3 land sample once per describe and split its assertions.
3. rivers.test, roads.test, photo-palette.test and the slow server tests (wipe, epitaphs, legacy): find each one's cost and cut it without weakening.
4. Inject each changed test's defect into old and new copies with mutate.mjs.
5. lint, typecheck, format, test; land on main; read per-test times from the CI run of the commit.
<!-- SECTION:PLAN:END -->
