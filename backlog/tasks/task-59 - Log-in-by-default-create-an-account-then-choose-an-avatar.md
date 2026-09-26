---
id: TASK-59
title: 'Log in by default; create an account, then choose an avatar'
status: To Do
assignee: []
created_date: '2026-09-26 13:34'
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
- [ ] #1 Visiting the site or /map while logged out shows the login screen, with a link to create an account
- [ ] #2 The create-account screen asks for username, password and the password again, has a distinct title and button (for example 'Create your account'), and looks visibly different from the login screen
- [ ] #3 Mismatched passwords are caught before submitting, with a clear message by the retype field; the server still validates the password as before
- [ ] #4 After the account is created, the player sees an avatar step using the existing avatar picker, saves an avatar, and then enters the game
- [ ] #5 A player who closes the window during the avatar step gets the avatar step again on their next visit, until they save one; the avatar can still be changed later from the game bar
- [ ] #6 Existing e2e sign-up helpers and specs are updated to the new flow and pass
<!-- AC:END -->
