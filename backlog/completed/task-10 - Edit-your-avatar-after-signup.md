---
id: TASK-10
title: Edit your avatar after signup
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 23:22'
updated_date: '2026-09-25 13:45'
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
- [x] #1 From the game view a player can open the avatar picker prefilled with their current avatar and save a change
- [x] #2 The player's own sprite updates immediately after saving
- [x] #3 Other players on the same screen see the new avatar without reloading
- [x] #4 The change persists across logout and login
- [x] #5 Covered by a Playwright test
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Protocol: add ServerMessage { t: 'avatar'; id; avatar }.
2. Server: PUT /api/me/avatar hands the saved user to game.changeAvatar, which swaps the live Player's user and broadcasts to the room. Reconnects already read the user fresh from the DB.
3. Client state applies 'avatar' to the matching remote; startGame exposes setAvatar so the own sprite redraws.
4. Game bar gets an Avatar button that opens a <dialog> holding the existing avatarPicker prefilled with the current avatar; Save calls updateAvatar.
5. Tests: server play test for the broadcast, client state unit test, Playwright spec with two contexts on the garden screen + logout/login persistence + screenshot.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
New ServerMessage { t: 'avatar', id, avatar }. PUT /api/me/avatar calls game.changeAvatar(user), which swaps the live Player.user (so later joiners see the new look via viewOf) and broadcasts to the room. The in-game editor is a <dialog> around the existing avatarPicker (ui/avatar-editor.ts); startGame gained setAvatar and a window.exploreUser debug hook for e2e. Verified: pnpm lint, typecheck, test (server test fails when the changeAvatar call is removed), format:check, pnpm e2e 10/10. e2e/avatar.spec.ts uses two contexts in the garden, asserts the other player sees the new avatar with exactly one websocket (no reconnect), and that it persists across logout/login. Screenshot e2e/.results/avatar-editor.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Players can open an Avatar dialog from the game bar (the signup picker, prefilled), save, and see their sprite change at once; others on the same screen get an 'avatar' socket message and redraw without reconnecting. Covered by a server play test, a client state test, and e2e/avatar.spec.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
