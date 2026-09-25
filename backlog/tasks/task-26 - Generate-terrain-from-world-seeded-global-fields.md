---
id: TASK-26
title: Generate terrain from world-seeded global fields
status: To Do
assignee: []
created_date: '2026-09-25 01:32'
labels: []
milestone: m-3
dependencies:
  - TASK-24
  - TASK-25
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: high
type: feature
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the neighbour-constrained generator with pure functions of the world seed and global coordinates, with the secret garden as a stamp inside a meadow clearing (decision-19, v2 design doc). Seams then match by construction in any generation order. Delete the neighbour-copy code and its tests in the same change.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Any tile's terrain and features depend only on the world seed, layer, and global position
- [ ] #2 Screens generated in any order agree on every shared lattice point (property test with shuffled orders)
- [ ] #3 The garden appears unchanged at (0,0) and its seams match the surrounding generated land
- [ ] #4 A world seed is stored once per world and changing it produces a different world
- [ ] #5 The neighbour-copy generator and its tests are removed
<!-- AC:END -->
