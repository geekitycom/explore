---
id: TASK-31
title: Music follows biomes
status: To Do
assignee: []
created_date: '2026-09-25 01:32'
labels: []
milestone: m-3
dependencies:
  - TASK-27
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: medium
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Key the music to the biome patch instead of per-screen heuristics, so one tune carries across a biome and changes only when you walk into a different one. Add moods for the new biomes (frontier, desert, highland, taiga, snow). Replaces screenMood and the 4x4 tune regions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Walking within one biome patch never changes the tune
- [ ] #2 Entering a different biome crossfades to its tune
- [ ] #3 Every biome has a mood, and the new moods are distinct by ear (checked with Andrew)
- [ ] #4 Players in the same biome patch hear the same tune
<!-- AC:END -->
