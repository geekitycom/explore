---
id: TASK-55
title: Keep music and the game running while the map is open
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-26 03:19'
updated_date: '2026-09-26 03:23'
labels: []
milestone: m-1
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Opening the map from the game bar used to be a plain link to /map, so the page reloaded: the audio context and the game socket died, and show() stopped music and ambience. The map should open inside the running game so music, ambience and the connection carry on, and closing it returns the player to where they were without a reload. Loading /map directly (a deep link, including logged out -> log in -> map) keeps working as a standalone page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Opening the map from the game (Map link or the M key) does not reload the page, reconnect the websocket, or stop music or ambience
- [ ] #2 The map closes with its Back to the game link, Escape, the M key, and the browser Back button, returning to the game without a reload
- [ ] #3 While the map is open, movement and action keys do not move or act for the player; after closing, the player moves again
- [ ] #4 The map fetches fresh data every time it opens
- [ ] #5 The URL shows /map while the map is open, and loading /map directly still shows the standalone map, with login first when logged out
- [ ] #6 An e2e test unlocks audio, opens the map, and checks audio output continues and the websocket did not reconnect, then closes it and moves
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. keyboard() in game/input.ts gains a paused flag (clears held keys); startGame exposes it.
2. main.ts gameView: map overlay appended over the game (game view inert), driven by the URL: pushState(/map) opens, history.back() closes, popstate syncs. Map link click and M open; Escape, M and the back link close. Fetch map on every open, discard a stale fetch.
3. mapView takes an optional onBack so the overlay link closes in place; the standalone /map page keeps href="/".
4. Extract the sound spec output-level probe into e2e/helpers.ts; add an e2e for audio and socket continuity, key isolation and all close paths; screenshot.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Decisions: the map opens as an overlay over the running game (dimmed game visible at the edges, full screen under 600px wide). The URL is its source of truth: opening pushes /map, every close (Back to the game link, Escape, M) calls history.back(), and popstate opens or closes it, so browser Back and Forward work too. While open, the game keyboard is paused (held keys cleared) and the game view is inert, so movement, E/Space, digits and Escape never reach the game; the map canvas keeps its own arrow/+/-/0 keys. The map is fetched on every open; a fetch that resolves after close is dropped. Ctrl/Cmd/Shift-click on the Map link still opens the standalone /map page in a new tab. Loading /map directly is unchanged (standalone page, login first). Ambience plays at full level; no ducking.

Validation: pnpm lint, typecheck, test (674+1), format:check pass; pnpm e2e 17/17. Mutation check: removing the key pause fails the new e2e on position, and making the Map link a plain navigation fails it on the websocket count (2 vs 1). Screenshot: e2e/.results/map-over-game.png.
<!-- SECTION:NOTES:END -->
