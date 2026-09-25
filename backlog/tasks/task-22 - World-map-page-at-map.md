---
id: TASK-22
title: World map page at /map
status: To Do
assignee: []
created_date: '2026-09-25 01:27'
updated_date: '2026-09-25 01:29'
labels: []
milestone: m-3
dependencies: []
priority: medium
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A page that shows the entire discovered world at once, so players can see how far it has grown and where they are. Draws every stored screen as a small rendering of its terrain and features, laid out by coordinate, with undiscovered space left dark.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Visiting /map while logged in shows every discovered screen at its world position, drawn from stored screen data
- [ ] #2 Undiscovered coordinates are clearly empty, and the secret garden and the viewer's current screen are marked
- [ ] #3 The map can be panned and zoomed and stays responsive with a few thousand screens
- [ ] #4 Logged-out visitors are sent to log in
- [ ] #5 The game view links to the map and back
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Confirmed with Andrew on 2026-09-24: any logged-in player can see the map.
<!-- SECTION:NOTES:END -->
