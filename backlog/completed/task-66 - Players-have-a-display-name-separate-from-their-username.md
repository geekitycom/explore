---
id: TASK-66
title: Players have a display name separate from their username
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 15:54'
updated_date: '2026-09-26 17:07'
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
- [x] #1 Signup asks for a username and a display name, with the display name required and length-limited, and gives a clear error for each field
- [x] #2 Other players, the map, the game bar, the avatar step, and credits (such as who named a landmark) show the display name, never the username
- [x] #3 Two accounts can have the same display name; usernames stay unique and case-insensitive
- [x] #4 A player can change their display name later from the game bar, where they change their avatar, and others see the new name without reconnecting
- [x] #5 The server trims the display name and rejects one that is empty after trimming
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shape: users.display_name (main migration 2, ALTER TABLE ... DEFAULT '' then UPDATE users SET display_name = username, so any account from before shows its username until it picks a name). Server User carries displayName; signup body { username, displayName, password }; PUT /api/me/profile { displayName, avatar } replaces PUT /api/me/avatar (the avatar step sends the current name with the chosen avatar). displayNameSchema and DISPLAY_NAME_MAX = 20 live in @explore/core (trim, min 1, max 20, no control characters) and back both the zod bodies and the inputs' maxlength. Live change: host/game changeAvatar became changeProfile, and the server message { t: 'avatar', id, avatar } became { t: 'profile', id, name, avatar }. PlayerView.name, the trace context me.name (server traces.ts and client hands.ts), the canvas label for yourself, the game bar, and the avatar step read displayName. The web User type drops username, so the compiler rejects any UI that tries to show it.

Credits: a credit stays a signature, { id, name } stored in the trace at the time it was made (landmark named.by, flowers by). The world file cannot join users (D25), so resolving the id at read time would need every trace sent to a client to go through the main database, and TraceStore has no handle on it. A signpost reading 'named by Andrew' also reads naturally as signed then. The consequence: renaming does not rewrite old credits. Ownership checks already compare by.id, so a rename never loses the right to rename or clear a landmark.

Game bar: the Avatar button became 'Name & avatar' and opens 'Your name and avatar', with a Display name field above the picker; a name error shows under the field.

Tests that would fail if the username leaked: server testing.userNamed gives every test user a username (login<id>) that differs from its display name; play.test signs up with capitalized display names and expects 'Alice' in PlayerView, landmark credits, refusal text, and names.ts; e2e helpers sign up with the username reversed as display name, so landmarks.spec 'named by', auth.spec game bar and avatar step copy all check the display name.

Verification: pnpm typecheck, pnpm lint, pnpm format:check clean; pnpm test 949 passed (943 before, plus display-name validation cases, trim and shared names, and the migration backfill); pnpm e2e 27 passed, 2 skipped (the two test.fixme restored by TASK-64.3, the avatar one updated to rename too). Drove the real app: built web, started node apps/server/src/main.ts on port 4817 with a tmp DATA_DIR, and a Playwright script in Chrome signed up username andrewshell, display name Andrew. Avatar step read 'This is how other explorers see you, Andrew.', the game bar showed 'Andrew' and never 'andrewshell'; renaming to Andy in the Name & avatar dialog updated the game bar and the label above the player at once and survived a reload; /api/me returned username andrewshell, displayName Andy; main.db user_version 2 with row andrewshell|Andy. Others seeing the rename live without reconnecting is proven by play.test 'shows a saved name and avatar to the same screen and to later arrivals' (real HTTP and WebSocket, one socket for Bob, message { t: 'profile', id: 1, name: 'Ali', avatar }) and host.test; the two-browser e2e for it stays fixme until TASK-64.3 lets two accounts share a world.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Players now have a display name separate from their username. Signup asks for both; the display name is required, trimmed, 1 to 20 characters (limit shared from core), not unique, with its own field error. Everything other players see (names above players, credits such as who named a landmark, the game bar, the avatar step) uses it, and the web client no longer holds the username. A player changes it from the game bar's Name & avatar dialog; PUT /api/me/profile saves name and avatar together and the live { t: 'profile', id, name, avatar } message updates everyone on the screen without reconnecting. Main database migration 2 adds users.display_name, backfilled from username. Credits stay signatures with the name at the time. Verified with 949 unit tests, 27 e2e (2 fixme for TASK-64.3), and a Playwright drive of the built app signing up andrewshell as Andrew and renaming to Andy.
<!-- SECTION:FINAL_SUMMARY:END -->
