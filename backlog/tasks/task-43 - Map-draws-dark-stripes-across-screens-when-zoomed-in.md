---
id: TASK-43
title: Map draws dark stripes across screens when zoomed in
status: To Do
assignee: []
created_date: '2026-09-25 15:58'
labels:
  - web
  - bug
dependencies: []
priority: low
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
On /map, pressing + to zoom in draws thin dark horizontal lines between rows of screens (seen on a 560-screen seeded world while verifying TASK-29; screenshot from that session showed a line at roughly every screen row). The lines are gaps between per-screen images at a non-integer scale, not terrain. Reproduce: seed a world with many visited screens, open /map, focus the map, press +.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Zooming the map in and out shows no gaps or lines between screens
- [ ] #2 An e2e or unit check covers the seam at more than one zoom level
<!-- AC:END -->
