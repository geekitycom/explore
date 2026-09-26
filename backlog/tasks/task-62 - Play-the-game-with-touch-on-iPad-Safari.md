---
id: TASK-62
title: Play the game with touch on iPad Safari
status: To Do
assignee: []
created_date: '2026-09-26 14:37'
updated_date: '2026-09-26 14:44'
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
- [ ] #1 On iPad Safari with no keyboard, a player can start the session from the wake-up screen by tapping, and audio unlocks from that tap
- [ ] #2 Pressing and holding on the world walks the avatar toward the pointer in 8 directions, releasing stops it, and holding toward an edge walks off the screen, with touch or with the mouse
- [ ] #3 A short click on something within reach that has an action (the thing the hint bar would offer) performs that action; a short click elsewhere does not trigger an action
- [ ] #4 The hint bar shows the available action as a button, and clicking it interacts with the faced tile
- [ ] #5 With an item selected, pressing the world shows the aim at the pointer, releasing uses the item there, and dragging off the world cancels, all without hover
- [ ] #6 No on-screen text mentions keys; the walking tip, the wake-up text, the map label, and the action prompts use 'click'
- [ ] #7 Touching the game does not zoom the page, scroll, select text, or open the iOS callout menu, and the layout fits the iPad viewport in portrait and landscape
- [ ] #8 Unit tests cover the pointer-to-direction logic, and an e2e run with Playwright iPad (WebKit, touch) emulation starts a session, walks, clicks a thing to interact, and uses an item
- [ ] #9 A player can open the map and return to the game by touch alone
- [ ] #10 Keyboard shortcuts (arrows/WASD, E/Space, 1-0, Escape, M) keep working
<!-- AC:END -->
