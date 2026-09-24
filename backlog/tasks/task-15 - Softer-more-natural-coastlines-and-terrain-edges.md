---
id: TASK-15
title: 'Softer, more natural coastlines and terrain edges'
status: To Do
assignee: []
created_date: '2026-09-24 23:22'
labels: []
milestone: m-1
dependencies: []
priority: low
type: enhancement
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Large coastlines stair-step because terrain lives on a 16px corner grid, and land edges read as rounded rectangles rather than the pack's tufted grass fringe (see task-4 notes). Improve the look without changing the stored screen format or seam guarantees (decision-9, decision-17).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Diagonal coastlines read as smooth curves rather than stairs in the art gallery and in game
- [ ] #2 Grass edges show a tufted fringe consistent with the Ninja Adventure style
- [ ] #3 Mask border-agreement tests still pass, and screens still match across seams
- [ ] #4 No change to the persisted screen record
<!-- AC:END -->
