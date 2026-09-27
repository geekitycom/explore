---
id: TASK-76
title: 'Pointer walking routes around obstacles, and double-click walks to a point'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 14:32'
updated_date: '2026-09-27 17:05'
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
- [x] #1 Holding the pointer on a reachable spot behind an obstacle (for example, inside a U-shape the avatar starts outside of) walks the avatar around the obstacle to that spot
- [x] #2 Moving the held pointer re-routes to the new spot
- [x] #3 Routes run in straight lines between turns instead of zig-zagging along tile centres
- [x] #4 Routes never cut across a blocked corner, and every pose along a route passes `canOccupy`
- [x] #5 Pointing at an unreachable or blocked spot walks to the nearest reachable spot instead of standing still or pushing against a wall
- [x] #6 Double-clicking with a mouse, or double-tapping on touch, a walkable point walks the avatar there after the button or finger lifts
- [x] #7 A double-click walk stops when the avatar arrives, a movement key is pressed, a new press starts on the world, or the screen changes
- [x] #8 Double-clicking a point in the outer tile band walks to that edge and on to the neighbouring screen, as holding there does today
- [x] #9 Presses on interactable tiles and aimed item use behave as before; double-click only applies to plain walk presses
- [x] #10 Unit tests cover route finding: around a U-shape, unreachable targets, no corner-cutting, and straight-line smoothing
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pure route finder in packages/core/src/route.ts: Dijkstra over the 20x15 tile grid (it must flood every reachable tile anyway for the nearest-reachable fallback), 8-neighbour with no corner cutting, exact feet-box sweep with 1px margin for line-of-sight smoothing, exit leg for edge targets.
2. Client walk intent state machine (none / held / queued) in walk-intent.ts; follow() walks straight at waypoints with canWalk per frame; game.ts caches the route by goal and place.
3. Double-click / double-tap on plain walk presses only; queued walk settles on arrival, movement key, screen change; new press replaces it.
4. Unit tests for route finder, walk intent, follow; e2e in mouse.spec.ts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Review found and fixed a stale-route bug: pressing the point the previous walk reached reused the spent route, so the avatar stood still; e2e reproduced it (stuck at x=141.6) and passes after clearing the route when no pointer walk is active. e2e now also covers a key stopping a double-click walk and a drag re-routing a held walk. Not driven in a browser: touch double-tap (same pointer-event path as mouse). Edge-band behaviour change: if the edge tile is blocked, the walk heads for the nearest reachable edge tile instead of sliding along the wall. Validation: typecheck, lint, format:check, 1068 unit tests, 39/39 Playwright. PR https://github.com/geekitycom/explore/pull/11
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pointer walks follow a route from findRoute (core): shortest 8-direction tile path with no corner cutting, smoothed into straight lines by an exact feet-box sweep, falling back to the nearest reachable tile. The client drives it with a none/held/queued walk-intent state machine; double-click or double-tap on a plain walk press queues a walk that ends on arrival, a movement key, a new press or a screen change, and edge-band targets walk off the screen. Verified with route/walk-intent/follow unit tests, a Playwright test around the garden pond (routing, repeat press, double-click, key stop, drag, edge crossing, no server corrections), and the full unit and e2e suites. PR #11.
<!-- SECTION:FINAL_SUMMARY:END -->
