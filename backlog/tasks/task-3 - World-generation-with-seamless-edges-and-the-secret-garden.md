---
id: TASK-3
title: World generation with seamless edges and the secret garden
status: To Do
assignee: []
created_date: '2026-09-24 21:29'
labels: []
milestone: m-0
dependencies:
  - TASK-2
priority: high
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pure generator that builds a screen from a seed and any existing neighbors so seams match, plus the hand-built secret garden at (0,0). Riskiest logic in M1. See doc-1 Generation section and decision-10, decision-11.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shared lattice points always equal the neighbor's (including diagonals) across many random seeds and neighbor layouts
- [ ] #2 Edge features copy the neighbor's facing edge
- [ ] #3 All walkable edge tiles of a generated screen are in one connected component
- [ ] #4 Same seed and neighbors produce the same screen
- [ ] #5 Secret garden has walkable openings on all four sides
- [ ] #6 A script renders a multi-screen preview so seams can be inspected visually
<!-- AC:END -->
