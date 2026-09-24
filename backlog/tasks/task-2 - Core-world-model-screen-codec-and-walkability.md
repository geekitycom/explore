---
id: TASK-2
title: 'Core world model, screen codec, and walkability'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 21:33'
labels: []
milestone: m-0
dependencies:
  - TASK-1
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the shared world types in @explore/core: screen dimensions, ScreenCoord, corner-lattice terrain, tile features, the persisted screen record and its compact codec, tile walkability, and player collision. Server validation and client prediction both use these. See doc-1 and decision-9.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Screen record round-trips through the codec and rejects malformed input
- [x] #2 Walkability follows the rules in doc-1 (blocking features, 3+ water corners)
- [x] #3 Collision check for a player hitbox at a pixel position is unit tested including edges
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. world.ts: dimensions, Terrain (layer-ordered tuple), Feature table with code + blocks, ScreenCoord, Screen, Dir with deltas, lattice/tile index helpers.
2. codec.ts: ScreenRecord v1 {v,sx,sy,seed,corners,features} one char per cell; encode + zod-validated decode at the boundary.
3. walk.ts: isTileWalkable (no blocking feature, <3 water corners), canOccupy(screen,x,y) for the feet hitbox, out-of-bounds treated as open so players can walk off edges.
4. avatar.ts: Avatar model (palette indices) + zod schema, needed by server signup in task-5.
5. Unit tests for each.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Avatar model (avatar.ts) landed here too because task-5 signup validates it. Palette entries are stored by name, not index, so reordering palettes never changes a saved avatar. Hair styles are provisional until the art pipeline (task-4) confirms what the CC0 sprites offer. testing.ts holds screen builders for tests.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added @explore/core world model (lattice terrain, tile features, directions), the v1 screen codec with zod-validated decode, tile walkability, feet-box collision with open off-screen pixels, and the avatar model. Verified with 7 Vitest cases covering round-trip, malformed input, walkability rules, collision edges, and off-screen behavior; lint and typecheck clean.
<!-- SECTION:FINAL_SUMMARY:END -->
