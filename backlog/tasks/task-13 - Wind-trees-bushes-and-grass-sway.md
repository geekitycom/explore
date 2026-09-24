---
id: TASK-13
title: 'Wind: trees, bushes, and grass sway'
status: To Do
assignee: []
created_date: '2026-09-24 23:22'
labels: []
milestone: m-1
dependencies: []
priority: medium
type: feature
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the world feel alive with wind. The pack has no sway frames for trees or grass, so sway is procedural: shift the top rows of canopy and grass sprites by a pixel on a slow cycle, with the phase travelling across the screen so gusts visibly roll through. Flowers use the pack's 4-frame animated plant (Backgrounds/Animated/Plant). Tall grass should rustle when a player walks through it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Tree canopies, bushes, and tall grass sway with a gust that travels across the screen; trunks stay still
- [ ] #2 Sway is 1px pixel-art motion with no blurring or sub-pixel smearing
- [ ] #3 Flowers animate using the pack's animated plant frames
- [ ] #4 Tall grass rustles when any player walks through it
- [ ] #5 Neighbouring screens look continuous when walking across a seam
- [ ] #6 Motion is disabled or reduced when the user prefers reduced motion
<!-- AC:END -->
