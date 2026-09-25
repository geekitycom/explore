---
id: TASK-20
title: Discovery jingle for brand-new screens
status: To Do
assignee: []
created_date: '2026-09-24 23:28'
updated_date: '2026-09-25 01:27'
labels: []
milestone: m-2
dependencies:
  - TASK-18
priority: low
type: feature
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a player is the first ever to reach a screen, play a short generated fanfare. The server knows when it generates a screen, so the screen message needs to say whether this arrival created it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The first visitor to a screen hears the jingle; later visitors do not
- [ ] #2 The screen message carries a flag for newly generated screens, covered by server tests
- [ ] #3 The jingle respects mute and effects volume
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Dropped on 2026-09-24: Andrew decided not to have a discovery jingle.
<!-- SECTION:NOTES:END -->
