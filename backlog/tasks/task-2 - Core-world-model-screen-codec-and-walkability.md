---
id: TASK-2
title: 'Core world model, screen codec, and walkability'
status: To Do
assignee: []
created_date: '2026-09-24 21:29'
labels: []
milestone: m-0
dependencies:
  - TASK-1
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define the shared world types in @explore/core: screen dimensions, ScreenCoord, corner-lattice terrain, tile features, the persisted screen record and its compact codec, tile walkability, and player collision. Server validation and client prediction both use these. See doc-1 and decision-9.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Screen record round-trips through the codec and rejects malformed input
- [ ] #2 Walkability follows the rules in doc-1 (blocking features, 3+ water corners)
- [ ] #3 Collision check for a player hitbox at a pixel position is unit tested including edges
<!-- AC:END -->
