---
id: TASK-12
title: Animated water
status: To Do
assignee: []
created_date: '2026-09-24 23:22'
labels: []
milestone: m-1
dependencies: []
priority: medium
type: feature
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Water is a static baked image. Bring ponds and lakes to life with the Ninja Adventure animated ripple sheet (Backgrounds/Animated/Water Ripples, 4 frames) and the water tileset variants (ripple, shine, lily pad, fish shadow). Terrain is baked once per screen (doc-1 Rendering), so animation must be layered or pre-baked as a few frames rather than recomposed every frame.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Open water visibly animates (ripples or shimmer) on a loop
- [ ] #2 Some water tiles carry lily pads or fish shadows, chosen deterministically per tile
- [ ] #3 Shorelines and seams stay identical to the static render
- [ ] #4 Frame rate stays smooth with a screen full of water
- [ ] #5 Animation pauses or is reduced when the user prefers reduced motion
<!-- AC:END -->
