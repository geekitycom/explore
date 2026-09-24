---
id: TASK-19
title: Generated music that follows the world
status: To Do
assignee: []
created_date: '2026-09-24 23:28'
labels: []
milestone: m-2
dependencies:
  - TASK-17
  - TASK-18
priority: medium
type: feature
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Play generated chiptune in game. The mood comes from what is on the current screen (garden, open meadow, water, dense forest) and the tune is seeded from the world, so every player hears the same music in the same place. Music changes only when the mood changes, crossfading rather than restarting on every screen. Uses the direction chosen in task-17.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every player hears the same tune on the same screen
- [ ] #2 Walking between screens of the same mood does not restart the music
- [ ] #3 Changing mood crossfades within about two seconds
- [ ] #4 Music generation is pure and unit-tested for determinism and scale/structure rules
- [ ] #5 CPU use stays low with music playing (no audible glitches while walking)
<!-- AC:END -->
