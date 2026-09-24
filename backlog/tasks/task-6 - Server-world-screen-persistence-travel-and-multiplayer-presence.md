---
id: TASK-6
title: 'Server world: screen persistence, travel, and multiplayer presence'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 21:43'
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
- [ ] #1 First visit to a coordinate generates and stores a screen; later visits return the identical screen
- [ ] #2 Travel places the player on the matching edge of the neighbor screen, nudged to a walkable tile if needed
- [ ] #3 Players on the same screen receive each other's join, move, and leave events; players elsewhere do not
- [ ] #4 Moves into blocked tiles or faster than the speed cap are corrected
- [ ] #5 Reconnecting resumes at the last saved position
- [ ] #6 Integration tests drive two real WebSocket clients
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delegated to a subagent in an isolated worktree; protocol defined in packages/core/src/protocol.ts before delegation.
<!-- SECTION:NOTES:END -->
