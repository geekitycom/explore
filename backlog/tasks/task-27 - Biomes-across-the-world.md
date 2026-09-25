---
id: TASK-27
title: Biomes across the world
status: To Do
assignee: []
created_date: '2026-09-25 01:32'
labels: []
milestone: m-3
dependencies:
  - TASK-26
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: high
type: feature
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Place biomes at world scale (meadow, forest, lakeland, scrubland, desert, highlands, taiga, tundra) using temperature and moisture fields, warped cells, and blended parameters so borders feel organic (v2 design doc). Adds darkgrass and snow terrains with their transitions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Biome regions span several screens and borders blend over roughly a screen rather than a straight line
- [ ] #2 Snow never borders desert directly
- [ ] #3 Darkgrass and snow render with coherent transitions against every other terrain
- [ ] #4 Each stored screen records its biome
- [ ] #5 The preview tool shows biome regions for review
<!-- AC:END -->
