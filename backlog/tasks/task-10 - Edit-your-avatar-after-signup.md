---
id: TASK-10
title: Edit your avatar after signup
status: To Do
assignee: []
created_date: '2026-09-24 23:22'
labels: []
milestone: m-1
dependencies: []
priority: medium
type: feature
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Players choose an avatar at signup but cannot change it later. The API already supports it (PUT /api/me/avatar); the game view needs a way to open the avatar picker, save, and see the change. Other players on the same screen should see the new look without reconnecting.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 From the game view a player can open the avatar picker prefilled with their current avatar and save a change
- [ ] #2 The player's own sprite updates immediately after saving
- [ ] #3 Other players on the same screen see the new avatar without reloading
- [ ] #4 The change persists across logout and login
- [ ] #5 Covered by a Playwright test
<!-- AC:END -->
