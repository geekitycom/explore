---
id: TASK-8
title: 'Web client: game rendering, movement, screen transitions, and other players'
status: To Do
assignee: []
created_date: '2026-09-24 21:29'
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
