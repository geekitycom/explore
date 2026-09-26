---
id: TASK-62
title: Play the game with touch on iPad Safari
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 14:37'
updated_date: '2026-09-26 15:30'
labels:
  - web
  - input
dependencies: []
priority: high
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The game is keyboard-only today: walking (arrows/WASD), interacting (E/Space), picking and using inventory slots (1-0), cancelling (Escape), opening the map (M), and starting the session from the wake-up screen (Space). On an iPad in Safari with no hardware keyboard, a player cannot get past the wake-up screen.

The game is aimed at kids (around 12), so pointing is the primary interface: tapping on iPad and clicking on desktop. The keyboard stays as a secondary shortcut layer, but the on-screen text talks only about clicking, never about keys. 'Click' is the word for both mouse and touch; kids on an iPad understand that tapping something is clicking it.

Settled design (brainstorm, 2026-09-26):
- Walk: press and hold on the world, and the avatar walks toward the pointer, snapped to 8 directions. Releasing stops it. Holding near an edge walks off it. Works the same with a mouse button.
- Click the thing: a short click on something the player can reach (a sign, an item on the ground) does that thing's action directly. A short click anywhere else is a brief walk toward it.
- Interact: the hint bar also becomes a button that shows the action, for example 'Read the sign'. Clicking it interacts with the faced tile.
- Items: clicking a slot selects it, and clicking it again deselects it (this already works). While an item is selected, pressing the world aims (the aim preview follows the finger), releasing uses it, and dragging off the world cancels. No hover is needed.
- Wake-up: click anywhere to start. That gesture unlocks audio.
- Map: the header 'Map' link and the map's 'Back to the game' link already work by touch. The map needs no gestures: TASK-63 makes it a fixed view centred on the player, with no pan or zoom.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 On iPad Safari with no keyboard, a player can start the session from the wake-up screen by tapping, and audio unlocks from that tap
- [x] #2 Pressing and holding on the world walks the avatar toward the pointer in 8 directions, releasing stops it, and holding toward an edge walks off the screen, with touch or with the mouse
- [x] #3 A short click on something within reach that has an action (the thing the hint bar would offer) performs that action; a short click elsewhere does not trigger an action
- [x] #4 The hint bar shows the available action as a button, and clicking it interacts with the faced tile
- [x] #5 No on-screen text mentions keys; the walking tip, the wake-up text, the map label, and the action prompts use 'click'
- [x] #6 Touching the game does not zoom the page, scroll, select text, or open the iOS callout menu, and the layout fits the iPad viewport in portrait and landscape
- [x] #7 Unit tests cover the pointer-to-direction logic, and an e2e run with Playwright iPad (WebKit, touch) emulation starts a session, walks, clicks a thing to interact, and uses an item
- [x] #8 A player can open the map and return to the game by touch alone
- [x] #9 Keyboard shortcuts (arrows/WASD, E/Space, 1-0, Escape, M) keep working
- [x] #10 With an item selected, pressing a tile within reach shows the aim at the pointer, releasing uses the item there, and dragging off the world cancels, all without hover; pressing out of reach walks
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Data shape: a press on the world is classified once, at pointerdown, by a pure function of (here, selected slot, pressed tile):
- aim: an item is selected and the tile is in reach. The aim follows the pointer; release on the screen uses the item on the aimed tile; release off the world or pointercancel cancels.
- act: no item selected, the tile is in reach, and resolve(interact) is not 'nothing'. Release on the same tile interacts with it (server already accepts any tile in reach).
- walk: anything else. While held, a pure steer(pose, target) in movement.ts gives the held directions (8 sectors, dead zone near the avatar, and a target in the outermost tile band is pushed past the edge so the player walks off). It replaces the keyboard's held set for that frame.

Steps:
1. movement.ts: steer() + unit tests (sectors, dead zone, edge push).
2. hands.ts: pointerdown/move/up/cancel state machine over Press = walk | act | aim, with pointer capture; right mouse button still deselects; hover aim kept for mouse. Renderer gets pointAt(event) in game px, tileAt derived from it. game.ts takes held directions from hands while a walk press is live, else from keys.
3. hint.ts: returns text plus whether it is actionable; prompts show the label only. main.ts: hint bar becomes a button that fires interact. Walking tip and wake text use 'click'. Inventory slots drop the visible key digits.
4. wake.ts: a click anywhere on the wake overlay starts and unlocks audio.
5. CSS/HTML: touch-action none and no callout/selection on the game; 100dvh layouts.
6. Tests: unit (steer, press classification, hint), existing e2e updated for new wording, new e2e/touch.spec.ts in a Playwright WebKit iPad project that wakes, walks, clicks a thing, uses an item, and opens and closes the map by tap.
7. Verify all suites; screenshots of the iPad run.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built by a delegate on a worktree branch, reviewed and fast-forwarded onto main (e3e553c..e03ad20).
Decisions beyond the plan: an act press fires only when released on the pressed tile; the renderer's tileAt was replaced by pointAt; exploreHud reports slot aria-labels; steer faces the axis the pointer is furthest along; the edge push is 2 tiles; an actionable hint is gold with a pointer cursor; audio unlock() now resumes a context left suspended (iOS does not treat a touch pointerdown as a user gesture), which only a real iPad can confirm.
e2e browsers are muted: Chrome with --mute-audio, WebKit through a zero-gain node before the speakers.
Validation: typecheck, lint, format:check clean; pnpm test 934 + 1 perf passed; pnpm e2e 28/28 passed (one earlier full run had a single cairn.spec failure that passed alone and on the rerun). The delegate broke five behaviours one at a time and touch.spec failed on each. iPad portrait and landscape screenshots checked by eye: world and bar fully visible, no key digits.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The game is playable by touch on iPad Safari and by mouse on desktop. Pressing the world walks toward the pointer in 8 directions and off edges; a press on something in reach does its action; with an item selected, a press in reach aims and release uses it. The hint bar is a button, the wake screen starts on a click and unlocks audio, and on-screen text says click instead of naming keys. Keyboard shortcuts still work. Verified with unit tests (steer, classify, hint), a WebKit iPad e2e spec, a mouse e2e spec, and the full suite (28/28).
<!-- SECTION:FINAL_SUMMARY:END -->
