---
id: TASK-36
title: Sprite recipe generator
status: To Do
assignee: []
created_date: '2026-09-25 01:37'
updated_date: '2026-09-25 01:51'
labels: []
milestone: m-4
dependencies:
  - TASK-33
  - TASK-34
documentation:
  - backlog/docs/doc-4 - Visual-language-and-asset-generation.md
priority: medium
type: feature
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the lasting version of the recipe approach: deterministic families (tree, bush, rock, flower, grass tuft, cactus, reeds, mushroom) as pure functions from params and seed to palette-constrained pixels, drawn by the client and shown in the gallery. Uses the direction settled by the spike.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each family renders deterministically per seed and passes the style lint
- [ ] #2 Placed objects use per-tile seeds so neighbouring trees of one species differ but read as the same species
- [ ] #3 Unit tests cover determinism, palette use, and anchoring
- [ ] #4 The game renders generated scenery with no visible drop in frame rate
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Scope per the task-33 verdict (D21): recipes for trees, conifers, cacti, rocks in the pack's drawing method; bushes and flowers as hand-drawn base shapes recoloured and varied by recipe. Fix the spike's tells: uneven drips, root bases, varied cactus widths and arms, varied rock cracks.
<!-- SECTION:NOTES:END -->
