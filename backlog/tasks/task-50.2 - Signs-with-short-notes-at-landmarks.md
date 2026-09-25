---
id: TASK-50.2
title: Name a landmark
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
updated_date: '2026-09-25 23:32'
labels: []
milestone: m-5
dependencies:
  - TASK-50.1
parent_task_id: TASK-50
priority: medium
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Landmarks are the points of interest the generator already places (POI_KINDS: stone circles, ruins, groves, lakesides, clearings, towns, caves, graveyards). The first player to reach a landmark that has no name can choose to name it. Naming plants a signpost at a spot the generator picks for that landmark, and everyone who walks up to it reads the name and who gave it; the name also appears on /map. There is one landmark per region, so names stay rare and need no allowance. Names are public text written by players, so they can be removed and reported.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Landmarks are defined in code from POI_KINDS, each with its area and a fixed signpost spot chosen by the generator that never blocks a road or traps a player
- [ ] #2 When a player stands in an unnamed landmark's area, the hint bar offers 'Name this place'; declining leaves it open for the next visitor, and named landmarks never offer it
- [ ] #3 The naming dialog takes a name (up to about 30 characters) and an optional short line (up to about 80), with live counts; saving plants the signpost; if two players save at once the first wins and the other is told who named it
- [ ] #4 Walking up to a signpost shows the name, the optional line and the namer in a bubble, and named landmarks show their names on /map
- [ ] #5 The namer can rename or clear their name; an admin command clears any name; players can report a name and reports are recorded
- [ ] #6 The signpost sprite is a recipe that passes pnpm lint:art
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo). Reading: the note shows in a bubble with the author's name when the player stands next to the sign, no key press.

Replaces free-form note signs placed from the inventory with a daily allowance. Decided 2026-09-25 while brainstorming how players get signs.
<!-- SECTION:NOTES:END -->
