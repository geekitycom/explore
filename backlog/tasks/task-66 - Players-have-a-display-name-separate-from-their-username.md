---
id: TASK-66
title: Players have a display name separate from their username
status: To Do
assignee: []
created_date: '2026-09-26 15:54'
labels: []
dependencies: []
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The username is for logging in (for example `andrewshell`); the display name is what other people see in the game (for example "Andrew"). Signup asks for both. Today the username shows in the game bar, on the avatar step, above players, and in credits such as who named a landmark; all of those should show the display name instead.

Display names are not unique: two players can both be "Andrew". The username stays unique and is only used to log in. TASK-64.1 wipes existing accounts, so there is nothing to migrate if this lands after it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Signup asks for a username and a display name, with the display name required and length-limited, and gives a clear error for each field
- [ ] #2 Other players, the map, the game bar, the avatar step, and credits (such as who named a landmark) show the display name, never the username
- [ ] #3 Two accounts can have the same display name; usernames stay unique and case-insensitive
- [ ] #4 A player can change their display name later from the game bar, where they change their avatar, and others see the new name without reconnecting
- [ ] #5 The server trims the display name and rejects one that is empty after trimming
<!-- AC:END -->
