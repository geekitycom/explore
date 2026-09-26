---
id: TASK-59
title: 'Log in by default; create an account, then choose an avatar'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 13:34'
updated_date: '2026-09-26 13:47'
labels: []
milestone: m-1
dependencies: []
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Logged-out visitors land on the login screen instead of the sign-up screen, since most visits are returning players. Creating an account becomes its own clearly different screen with a username, a password and a retyped password that must match, and no avatar picker. After the account is created, the player chooses their avatar on a separate step, reusing the existing avatar picker, and then enters the game. The sign-up screen must look visibly different from login so nobody confuses the two.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Visiting the site or /map while logged out shows the login screen, with a link to create an account
- [x] #2 The create-account screen asks for username, password and the password again, has a distinct title and button (for example 'Create your account'), and looks visibly different from the login screen
- [x] #3 Mismatched passwords are caught before submitting, with a clear message by the retype field; the server still validates the password as before
- [x] #4 After the account is created, the player sees an avatar step using the existing avatar picker, saves an avatar, and then enters the game
- [x] #5 A player who closes the window during the avatar step gets the avatar step again on their next visit, until they save one; the avatar can still be changed later from the game bar
- [x] #6 Existing e2e sign-up helpers and specs are updated to the new flow and pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Data shape: users gain avatar_chosen INTEGER NOT NULL DEFAULT 1 (existing accounts count as chosen). insertUser always stores DEFAULT_AVATAR with avatar_chosen = 0; PUT /api/me/avatar sets it to 1. User carries avatarChosen: boolean, so /api/me, /api/login and /api/signup tell the client. A player who connects without choosing plays with the default avatar; the server does not block them.
1. Server: migration, users.ts/sessions.ts, POST /api/signup drops avatar (extra keys ignored), unit tests (signup unchosen, avatar save marks chosen, across login).
2. Web: View gains {kind:'avatar'}; enter(user, place) is the single hand-off (avatar step when unchosen, else game/map). Logged-out default is login. Create-account screen: title 'Create your account', retype field with client-side mismatch message, snow-blue panel with water strip. Avatar step reuses avatarPicker and updateAvatar.
3. e2e: helpers signUp goes through create + avatar step; new specs for login default, mismatch, create->avatar->game, close during avatar step. Screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Data shape: users.avatar_chosen (migration 8, DEFAULT 1 so existing accounts skip the step). New accounts store DEFAULT_AVATAR with avatar_chosen = 0; PUT /api/me/avatar sets 1. User.avatarChosen rides /api/me, /api/login, /api/signup. POST /api/signup no longer takes an avatar (extra keys are ignored). A player who connects to /ws before choosing plays with the default avatar; the client never routes them there because enter(user, place) in main.ts sends unchosen users to the avatar step first. enter() is the single hand-off TASK-58's wake-up should hook into.
Create-account screen: 'Create your account' title, 'Password again' field (client-side mismatch check, retype never sent), snow-blue panel with a water strip and gold button from the palette. Avatar step: 'Choose your avatar' page reusing avatarPicker, 'Start exploring' saves via PUT /api/me/avatar.
e2e: the full suite had grown to exactly the 20/hour per-address signup limit, so the extra signup tipped it over. The e2e server now runs with TRUST_PROXY=true and createAccount() sends a fresh X-Forwarded-For per account; server rate limits are unchanged and still covered by app.test.ts and the throttled-login e2e.
Note: decision D4 in doc-2 still says signup includes choosing the avatar; the avatar is now chosen right after signup.
Validation: pnpm lint, typecheck, test (750 passed), format:check, e2e (20 passed). Screenshots: login.png, create-account.png, create-account-mismatch.png, avatar-step.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Logged-out visitors now land on login. Create account is a separate snow-blue screen with username, password and password again (mismatch caught client-side, retype never sent). After creating an account the player chooses an avatar on its own step, which returns on every visit until saved (users.avatar_chosen), then enters the game through main.ts enter(). Verified with unit tests (signup unchosen, save marks chosen across login, migration keeps old accounts chosen) and e2e for login default, mismatch, create->avatar->game, and leaving mid-step.
<!-- SECTION:FINAL_SUMMARY:END -->
