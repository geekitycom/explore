---
id: TASK-6
title: 'Server world: screen persistence, travel, and multiplayer presence'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 21:55'
labels: []
milestone: m-0
dependencies:
  - TASK-3
  - TASK-5
priority: high
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Persist screens and player positions, create screens on first visit from their neighbors, and run the WebSocket protocol for movement, travel, and same-screen presence. See doc-1 Server and Protocol sections, decision-6, decision-12.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 First visit to a coordinate generates and stores a screen; later visits return the identical screen
- [x] #2 Travel places the player on the matching edge of the neighbor screen, nudged to a walkable tile if needed
- [x] #3 Players on the same screen receive each other's join, move, and leave events; players elsewhere do not
- [x] #4 Moves into blocked tiles or faster than the speed cap are corrected
- [x] #5 Reconnecting resumes at the last saved position
- [x] #6 Integration tests drive two real WebSocket clients
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Delegated to a subagent in an isolated worktree; reviewed and cherry-picked. core travel.ts arrivalPose (per-edge table, mirrored entry, nudge along the edge then inward); migration 2 (screens, player_state); world.ts repository with synchronous getOrCreateScreen; presence.ts rooms per occupied screen; play.ts createGame (connect, receive, disconnect, flush) with zod at the socket boundary; /ws via @hono/node-ws with cookie auth; 5s flush plus flush on SIGINT/SIGTERM.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delegated to a subagent in an isolated worktree; protocol defined in packages/core/src/protocol.ts before delegation.

Decisions: move budget counts time since last accepted move capped at 1s so idle players can't bank distance. Moves are checked at their end point (about 7px per 10Hz step, under half a tile). Rejected travel gets 'correct'. A replacing connection resumes from the old in-memory pose; room sees leave then join. Arrival is 1px inside the edge, along-edge coordinate clamped. SIGINT/SIGTERM flush dirty poses.
Verification: 11 real-socket integration tests plus socket-free game test, 6 travel unit tests; nine targeted mutations each caught (the one uncaught mutation, removing the early return in getOrCreateScreen, is behavior-neutral because of ON CONFLICT DO NOTHING). Live run: garden on connect, 35 moves with zero corrections, travel east generated (1,0), restart returned the same screen and resumed pose. All 126 repo tests pass after cherry-pick onto main.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added screen persistence, lazy generation on first visit, travel with walkable arrival, same-screen presence over /ws, server-side move validation, and resume-on-reconnect. Verified with real-socket integration tests covering every acceptance criterion, mutation checks, and a live run across a server restart.
<!-- SECTION:FINAL_SUMMARY:END -->
