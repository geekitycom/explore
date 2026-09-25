---
id: TASK-42
title: 'Map shows visited screens, not every generated one'
status: To Do
assignee: []
created_date: '2026-09-25 14:19'
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
- [ ] #1 The map shows only screens a player has stood on, per the chosen visibility rule, and not prefetched or chunk-filled screens
- [ ] #2 Visits are recorded server-side when a player enters a screen and survive restarts
- [ ] #3 e2e/map.spec.ts covers that a freshly signed-up player sees the garden and nothing prefetched
<!-- AC:END -->
