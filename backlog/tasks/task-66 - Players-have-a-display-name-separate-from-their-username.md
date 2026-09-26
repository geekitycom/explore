---
id: TASK-66
title: Players have a display name separate from their username
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-26 15:54'
updated_date: '2026-09-26 16:57'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: DISPLAY_NAME_MAX (20) and displayNameSchema (trim, non-empty, max, no control characters) shared by client and server.
2. Main database migration 2: users.display_name, backfilled from username. Server User carries displayName; signup body takes displayName; one profile endpoint PUT /api/me/profile {displayName, avatar} replaces PUT /api/me/avatar.
3. Live change: host.changeAvatar/game.changeAvatar and the 'avatar' server message become changeProfile and { t: 'profile', id, name, avatar }; PlayerView.name, trace 'me.name' (credits), and the web client all read displayName.
4. Credits keep storing a signature { id, name } in the world file (the name at the time), fed from displayName.
5. Web: signup form gets a Display name field with its own error; web User drops username so it cannot leak into the UI; game bar shows displayName; the in-game Avatar dialog gains a Name field and saves both; avatar step copy uses displayName.
6. Tests: server unit (signup validation, trim, duplicates, migration backfill, live profile broadcast, credits), web state test, e2e helper signs up with a display name that differs from the username so any leak fails existing specs; e2e for signup validation and in-game rename.
7. Verify: typecheck, lint, format, unit, e2e, and drive the built app with Playwright (andrewshell / Andrew).
<!-- SECTION:PLAN:END -->
