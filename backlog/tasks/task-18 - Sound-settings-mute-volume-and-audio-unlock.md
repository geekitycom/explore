---
id: TASK-18
title: 'Sound settings: mute, volume, and audio unlock'
status: To Do
assignee: []
created_date: '2026-09-24 23:28'
labels: []
milestone: m-2
dependencies: []
priority: high
type: feature
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The game has no settings UI and browsers block audio until the player interacts. Add a small settings control in the game bar with mute and separate music and effects volumes, remembered per browser, and start audio on the first key press or click.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Audio starts only after the first key press or click, with no console errors before that
- [ ] #2 Mute and music/effects volume controls are reachable by keyboard and screen reader
- [ ] #3 Settings persist across reloads in the same browser and default to a moderate volume
- [ ] #4 Audio is muted while the tab is hidden and resumes when it is visible again
<!-- AC:END -->
