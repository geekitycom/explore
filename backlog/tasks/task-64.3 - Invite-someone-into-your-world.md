---
id: TASK-64.3
title: Open your world for visitors
status: To Do
assignee: []
created_date: '2026-09-26 15:45'
updated_date: '2026-09-26 15:53'
labels: []
dependencies:
  - TASK-64.2
parent_task_id: TASK-64
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Worlds are closed by default. The owner can switch their world to "open for visitors", which shows a short, easy-to-type code. The code is not single use: anyone logged in who has it can join while the world stays open, so a kid can share it in a group chat and several friends can come in. Meant for friends and family the owner chooses, never strangers.

Visitors can only be in a world while its host is there and it is open. It closes to visitors when the owner closes it, logs out, their play session ends (`SESSION_TIMEOUT_MS`, D24; a reload or brief disconnect within the timeout does not end it), or the owner goes to visit another world. When it closes, every visitor is sent back to their own world with a short message saying why. Opening it again gives a new code.

A visitor arrives in the host's secret garden and can walk anywhere in the host's world. While visiting, their position, traces, and inventory are stored in the host's world and stay there when they go home (D25).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A world is closed to visitors by default, and no code joins a closed world
- [ ] #2 The owner can open their world from inside the game and sees a short, easy-to-type code; they can close it again
- [ ] #3 Several players can join with the same code while the world is open
- [ ] #4 A visitor arrives on a random walkable tile in the host's secret garden that no other player (host or visitor) is standing on
- [ ] #5 A visitor can walk anywhere in the host's world, and screens they explore are added to the host's world and map
- [ ] #6 The map shows where each player in the world is, host and visitors alike
- [ ] #7 An unknown code or a closed world is refused with a friendly message
- [ ] #8 A visitor can go back to their own world; items they picked up while visiting stay in the host's world, and their home world is unchanged by the visit
- [ ] #9 There is no way to find or join a world without its current code
- [ ] #10 The world closes to visitors when the owner closes it, logs out, their session ends, or they go to visit another world; a code from an earlier opening no longer works
- [ ] #11 When the world closes, every visitor in it is sent back to their own world at once, with a short message saying the host closed their world
<!-- AC:END -->
