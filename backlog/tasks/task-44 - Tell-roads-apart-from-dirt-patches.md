---
id: TASK-44
title: Tell roads apart from dirt patches
status: To Do
assignee: []
created_date: '2026-09-25 15:58'
labels:
  - core
  - web
dependencies:
  - TASK-29
priority: low
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Roads (TASK-29) are rasterised as dirt, the same terrain as the dirt patches in scrubland and highlands, so in those biomes a road merges into the patches on screen and on /map. Give roads a look of their own (for example a worn-path terrain or an edge treatment) so a player can follow one through dirt-heavy land. Roads are marked by the network's plan in core generate.ts (terrainAt), so a change there plus rendering in apps/web is the likely shape; it changes generator output, so bump GENERATOR_VERSION per decision D23.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A road is visually distinct from a dirt patch in the game view and on /map
- [ ] #2 Stored screens keep their look; only new screens change (D23)
<!-- AC:END -->
