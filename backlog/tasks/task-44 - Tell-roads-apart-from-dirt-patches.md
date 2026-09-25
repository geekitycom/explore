---
id: TASK-44
title: Tell roads apart from dirt patches
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-25 15:58'
updated_date: '2026-09-25 16:43'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: add a 'path' terrain (codec 'p') drawn between dirt and grass; terrainAt lays roads as path (fords stay sand). Bump GENERATOR_VERSION 3->4 (D23). No record version bump: old records decode unchanged, the new code is additive.
2. Web: path fill from the pack's unused grey-brown soil tiles (soil ramp colours, lint:art clean), a darker soil rim; map colour and preview colour from the soil ramp; WIND entry.
3. Keep stored screens' look: terrain fill decoration hashes by a fixed per-terrain salt, not the draw index, so inserting a layer does not move decorated fills on stored screens.
4. Tests: roads are path (or sand fords) and path is only on roads; seam and pair tests cover path; road test expectations move from dirt to path.
5. Screenshots before/after of scrubland road (seed 1, screen 3,-8) in game and on /map.
<!-- SECTION:PLAN:END -->
