---
id: TASK-64.2
title: 'Each account owns a world, and a connection joins one world'
status: To Do
assignee: []
created_date: '2026-09-26 15:45'
labels: []
dependencies:
  - TASK-64.1
parent_task_id: TASK-64
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make worlds per player. The main database gets a world registry (world id separate from the owner's user id, owner, host that serves it) and a record of who may enter each world. Signup creates the new player's world. The server runs one game per open world instead of one global game, opening a world when its first player connects and closing it when nobody has been in it for a while. The client always says which world it is joining, and nothing on the server assumes there is only one world. See decision-25.

The host column is always this server for now; routing between servers is out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Signup creates a world file with its own seed and garden, registered to the new user
- [ ] #2 A player connects to their own world by default; connecting to a world they may not enter is refused
- [ ] #3 Players in different worlds never receive each other's presence, movement, traces, or screens
- [ ] #4 Several worlds can be open at once, each saving positions on its own, and an idle world is closed and reopens with its state intact
- [ ] #5 Admin scripts take the world they act on
- [ ] #6 Multiplayer unit and e2e tests still run by giving the second player access to the first player's world
<!-- AC:END -->
