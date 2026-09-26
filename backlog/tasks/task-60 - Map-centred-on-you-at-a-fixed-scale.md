---
id: TASK-60
title: Map centred on you at a fixed scale
status: To Do
assignee: []
created_date: '2026-09-26 13:50'
labels: []
milestone: m-1
dependencies: []
priority: medium
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The world map currently scales to fit every discovered screen, which shrinks as the world grows and invites trying to see the whole world. Instead, the map opens centred on the player's screen with every screen drawn at one fixed size, showing as much of the surroundings as fits the window. Players get a sense of what they have explored nearby, never a view of everything. The scale never depends on how many screens are discovered.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The map opens with the player's screen at the centre of the view, at a fixed size per screen that never depends on how many screens are discovered
- [ ] #2 A larger window shows more screens around the player at the same size; a smaller one shows fewer
- [ ] #3 The player can still pan to look around and return to their own screen with one key or button; zoom, if kept, only moves between a few fixed sizes chosen by the player
- [ ] #4 Labels, whole-pixel snapping and the in-game map overlay keep working, in both the overlay and standalone /map
- [ ] #5 Unit or e2e tests show the screen size is the same for a world with 2 discovered screens and one with 500, and that the player's screen is centred
<!-- AC:END -->
