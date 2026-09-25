---
id: TASK-26
title: Generate terrain from world-seeded global fields
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 13:22'
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
- [x] #1 Any tile's terrain and features depend only on the world seed, layer, and global position
- [x] #2 Screens generated in any order agree on every shared lattice point (property test with shuffled orders)
- [x] #3 The garden appears unchanged at (0,0) and its seams match the surrounding generated land
- [x] #4 A world seed is stored once per world and changing it produces a different world
- [x] #5 The neighbour-copy generator and its tests are removed
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Delegated to a subagent (strongest-judgment model) in an isolated worktree. Pure world-seeded fields over global lattice coordinates (elevation, moisture, detail, warp) with a single temperate parameter set ready for biomes in task-27; garden stamp with a meadow falloff ring; features from seeded density fields; pure edge crossings shared by both screens of every edge so the world stays connected until roads land; per-screen connectivity repair that never changes shared lattice points; world table with the seed, rolled by the wipe; server generates per screen from the seed; preview gets a fields source; neighbour-copy code and tests deleted.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delegated to a subagent (Fable 5.1) in an isolated worktree; reviewed renders and cherry-picked onto main after the map page. Commit trailer names Fable 5.1 truthfully.
Design: noise.ts (hash, fBm, warp); fieldsOf(world, layer) seeds per purpose; stamps; disjoint star-shaped lakes (one per lake-grid cell, never all-water screens, never touching the garden clearing) so land is connected by construction; dryness dirt; clumped forest field; pure per-seam crossings; per-screen repair that clears features only. arrivalPose now takes entry tiles so the nudge never strands anyone. Migration 4 adds the world table (random seed) and deletes stored screens and positions because codec v3 drops the per-screen seed; wipe rolls a new seed.
Rejected during tuning: joining all walkable edge tiles (sand causeways through lakes) and closing edge pockets with bushes (visible grid along forest seams).
Verified: 1.7 ms per screen; property tests over six seeds on 12x12 regions (seam equality in shuffled orders, crossings on every land seam, garden-BFS reaches every screen), determinism, seeds differ, layer matters, garden intact; mutations (no crossings: 13 failures; crossings keep blockers: 12 failures). Renders scratchpad/fields/after-seed1-48.png versus preview-tool/default-32.png: no screen grid, forests and meadows span many screens. In-game screenshot of the trail south of the garden. After merge: 179 unit tests, build, and 8 e2e tests pass.
Known weaknesses: lakes read as evenly spaced blobs; dense forests show thin cleared corridors; garden trails a bit heavy; crossingTiles recomputed per travel (about 0.1 ms).

Follow-up on 2026-09-25 (Andrew): the migration no longer deletes stored screens and positions. The server counts screens whose record version is not SCREEN_RECORD_VERSION and refuses to start with instructions to run pnpm world:wipe --yes (decision D22). Verified on a copy of an old database: startup exits 1 with the message and leaves 2 screens and 2 positions intact; after the wipe the server starts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the neighbour-constrained generator with world-seeded global fields: stored world seed, garden stamp in a meadow clearing, disjoint lakes, clumped forests, pure seam crossings with per-screen repair, and a preview source. Seams match in any order and the garden reaches every screen. Verified with property and mutation tests, renders, timings, and the full unit and e2e suites.
<!-- SECTION:FINAL_SUMMARY:END -->
