---
id: TASK-8
title: 'Web client: game rendering, movement, screen transitions, and other players'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 22:10'
labels: []
milestone: m-0
dependencies:
  - TASK-6
  - TASK-7
priority: high
type: feature
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Canvas game view that renders the current screen with transitions and y-sorted features, moves the avatar with keyboard input and collision, travels by walking off an edge, and shows other players on the same screen. See doc-1 Rendering and Protocol sections, decision-13.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The secret garden renders with coherent transitions at an integer scale
- [x] #2 Arrow keys and WASD move the avatar with a walk animation and it cannot pass blocking tiles
- [x] #3 Walking off an edge shows the adjacent screen with the avatar on the matching edge
- [x] #4 Two browsers on the same screen see each other move; on different screens they do not
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. game/movement.ts (pure): step a pose by held directions, dt, and the screen; axis-separated collision through core canOccupy so players slide along walls; report the edge direction when the feet cross off-screen.
2. game/net.ts: WebSocket connection to /ws with JSON ServerMessage/ClientMessage, reconnect with backoff, 'replaced' close handled as a notice.
3. game/state.ts: apply server messages (screen, join, leave, moved, correct) to one GameState; remote players interpolate toward their latest pose.
4. game/game.ts: rAF loop, keyboard input (arrows + WASD), throttled move reports (MOVE_INTERVAL_MS), travel handshake that freezes input until the next screen arrives, integer-scaled canvas, terrain baked once per screen, features and players y-sorted, name labels.
5. Verify with unit tests for movement and state, and Playwright e2e with two browser contexts seeing each other and a screen transition.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Renderer (game/render.ts) scales to the largest integer that fits, bakes terrain and feature sprites once per screen, y-sorts features and players, and draws name labels at device resolution. A read-only window.exploreState hook lets e2e tests observe state.
Found in e2e: arrival 1px inside the top edge hid the player behind edge trees and clipped the sprite; core arrivalPose now insets feet by half a tile on the sides and 14px at the top so the whole sprite is visible (travel and server tests updated). A refused travel ('correct') now returns the client from travelling to playing.
Verification: movement and state unit tests (12); Playwright e2e/world.spec.ts with two browser contexts seeing each other in the garden and one walking (the other's view moves), leave on disconnect, walking south off the garden onto a generated screen and back north. Screenshots reviewed: garden with two named players; generated screen south of the garden with the dirt path continuing across the seam.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the playable client: canvas renderer with transitions and y-sorted sprites, keyboard movement with collision and walk animation, throttled position reports, travel by walking off edges, and live other players on the same screen. Verified with unit tests and Playwright multi-browser e2e against the real server.
<!-- SECTION:FINAL_SUMMARY:END -->
