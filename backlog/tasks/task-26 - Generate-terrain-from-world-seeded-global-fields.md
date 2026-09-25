---
id: TASK-26
title: Generate terrain from world-seeded global fields
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 01:51'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Delegated to a subagent (strongest-judgment model) in an isolated worktree. Pure world-seeded fields over global lattice coordinates (elevation, moisture, detail, warp) with a single temperate parameter set ready for biomes in task-27; garden stamp with a meadow falloff ring; features from seeded density fields; pure edge crossings shared by both screens of every edge so the world stays connected until roads land; per-screen connectivity repair that never changes shared lattice points; world table with the seed, rolled by the wipe; server generates per screen from the seed; preview gets a fields source; neighbour-copy code and tests deleted.
<!-- SECTION:PLAN:END -->
