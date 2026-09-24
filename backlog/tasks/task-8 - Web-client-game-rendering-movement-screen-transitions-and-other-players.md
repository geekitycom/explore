---
id: TASK-8
title: 'Web client: game rendering, movement, screen transitions, and other players'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 21:46'
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
- [ ] #1 The secret garden renders with coherent transitions at an integer scale
- [ ] #2 Arrow keys and WASD move the avatar with a walk animation and it cannot pass blocking tiles
- [ ] #3 Walking off an edge shows the adjacent screen with the avatar on the matching edge
- [ ] #4 Two browsers on the same screen see each other move; on different screens they do not
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. game/movement.ts (pure): step a pose by held directions, dt, and the screen; axis-separated collision through core canOccupy so players slide along walls; report the edge direction when the feet cross off-screen.
2. game/net.ts: WebSocket connection to /ws with JSON ServerMessage/ClientMessage, reconnect with backoff, 'replaced' close handled as a notice.
3. game/state.ts: apply server messages (screen, join, leave, moved, correct) to one GameState; remote players interpolate toward their latest pose.
4. game/game.ts: rAF loop, keyboard input (arrows + WASD), throttled move reports (MOVE_INTERVAL_MS), travel handshake that freezes input until the next screen arrives, integer-scaled canvas, terrain baked once per screen, features and players y-sorted, name labels.
5. Verify with unit tests for movement and state, and Playwright e2e with two browser contexts seeing each other and a screen transition.
<!-- SECTION:PLAN:END -->
