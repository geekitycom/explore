---
id: TASK-42
title: 'Map shows visited screens, not every generated one'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 14:19'
updated_date: '2026-09-25 14:29'
labels:
  - web
  - server
dependencies:
  - TASK-28
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Since TASK-28 the server generates and stores the world in 4x4-screen chunks and prefetches the chunks around each player, so the screens table holds land nobody has walked. /map lists every stored screen on the viewer's layer (apps/server/src/map.ts), so it now reveals unvisited terrain, including the whole starting chunk and its neighbours right after signup. Decide what the map means (screens the viewer visited, or screens anyone visited) and record visits so the map can filter on them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The map shows only screens a player has stood on, per the chosen visibility rule, and not prefetched or chunk-filled screens
- [x] #2 Visits are recorded server-side when a player enters a screen and survive restarts
- [x] #3 e2e/map.spec.ts covers that a freshly signed-up player sees the garden and nothing prefetched
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Additive migration: visits table keyed (layer, sx, sy), one row per visited screen, backfilled from player_state positions only.
2. recordVisit in world.ts; play.ts records a visit whenever it sends a player a screen (connect and travel).
3. /api/map joins screens with visits; wipe clears visits with the rest of the world.
4. Tests: map API before/after travel and across a restart, migration backfill, wipe; e2e map.spec asserts a fresh player sees the garden and no chunk-filled screens.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Default chosen while the user is away: the map shows screens that ANY player has stood on (a shared map), matching what /map meant before chunked prefetch. Existing databases count only screens holding a player's last saved position as visited; other stored screens are not backfilled. Reverse by filtering visits per user (would need a user_id column).

Validation: pnpm lint, typecheck, format:check clean; pnpm test 319/319; pnpm e2e 11/11. With the old map query restored, e2e/map.spec.ts fails (16 screens instead of the garden), so the spec catches the regression. Screenshot e2e/.results/map.png shows 2 screens after one step south.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a visits table (layer, sx, sy; one row per visited screen) filled whenever the server sends a player a screen, on connect and on travel. /api/map joins screens with visits, so prefetched and chunk-filled land stays hidden until someone stands on it. The map is shared: it shows screens any player has visited. The migration backfills visits from saved player positions only. wipeWorld clears visits too. Verified with server tests for the map before and after travel, across a restart, for a second player, for the migration backfill, and for the wipe, plus the updated e2e map spec.
<!-- SECTION:FINAL_SUMMARY:END -->
