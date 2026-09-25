---
id: TASK-48.2
title: Bones and skulls scattered in the desert and other dry lands
status: To Do
assignee: []
created_date: '2026-09-25 19:18'
labels: []
milestone: m-4
dependencies: []
parent_task_id: TASK-48
priority: medium
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bones, skulls (for example cattle and ram skulls) and rib cages as small scenery, most common in the desert, less often in scrubland and tundra. Built as a recipe family with deterministic per-tile variation and added to the per-biome dressing and flora data (BIOME_PARAMS, PATCHES, FLORA).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A bones recipe family yields skulls, scattered bones and rib cages with per-seed variation
- [ ] #2 Desert screens show bones regularly; scrubland and tundra show them rarely; lush biomes never
- [ ] #3 Every variant passes pnpm lint:art and uses only palette ramps
- [ ] #4 The art gallery shows the family
<!-- AC:END -->
