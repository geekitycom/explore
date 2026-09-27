---
id: TASK-76
title: 'Pointer walking routes around obstacles, and double-click walks to a point'
status: To Do
assignee: []
created_date: '2026-09-27 14:32'
labels:
  - client
  - core
dependencies: []
references:
  - apps/web/src/game/movement.ts
  - apps/web/src/game/hands.ts
  - apps/web/src/game/game.ts
  - packages/core/src/walk.ts
documentation:
  - backlog/docs/doc-1 - Architecture.md
priority: medium
type: feature
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Walking with the pointer today goes in a straight line. `steer()` in `apps/web/src/game/movement.ts` aims the avatar at the held pointer in one of 8 directions, and `step()` slides along whatever blocks it. Against a U-shaped obstacle, a fence run, or a river bend the avatar ends up pressed against the wall and never gets to the spot the player is holding.

Pointer walking should find a way around obstacles, the way players expect in a click-to-move game. Each screen is a 20x15 tile grid with per-tile walkability (`isWalkable` in `packages/core/src/walk.ts`), so the search is cheap enough to re-run whenever the target changes.

Players should also be able to double-click (or double-tap) a point to walk there without holding the button down.

Keyboard movement does not change. The server contract does not change: the client still sends ordinary `move` poses, and every pose on a route must pass `canOccupy`. TASK-72 is tightening server move validation, so routes must never cut through blocked tiles or corners.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Holding the pointer on a reachable spot behind an obstacle (for example, inside a U-shape the avatar starts outside of) walks the avatar around the obstacle to that spot
- [ ] #2 Moving the held pointer re-routes to the new spot
- [ ] #3 Routes run in straight lines between turns instead of zig-zagging along tile centres
- [ ] #4 Routes never cut across a blocked corner, and every pose along a route passes `canOccupy`
- [ ] #5 Pointing at an unreachable or blocked spot walks to the nearest reachable spot instead of standing still or pushing against a wall
- [ ] #6 Double-clicking with a mouse, or double-tapping on touch, a walkable point walks the avatar there after the button or finger lifts
- [ ] #7 A double-click walk stops when the avatar arrives, a movement key is pressed, a new press starts on the world, or the screen changes
- [ ] #8 Double-clicking a point in the outer tile band walks to that edge and on to the neighbouring screen, as holding there does today
- [ ] #9 Presses on interactable tiles and aimed item use behave as before; double-click only applies to plain walk presses
- [ ] #10 Unit tests cover route finding: around a U-shape, unreachable targets, no corner-cutting, and straight-line smoothing
<!-- AC:END -->
