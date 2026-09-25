---
id: TASK-41
title: Speed up terrain baking on screen entry
status: To Do
assignee: []
created_date: '2026-09-25 14:00'
labels: []
milestone: m-4
dependencies: []
priority: low
type: bug
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found while verifying TASK-36. bakeTerrain in apps/web/src/art/terrain.ts takes about 90 ms per screen (mean over 20 screens of world 98765, Vite dev server, Chrome on an M-series Mac), so buildScene spends almost all its time there on each new screen. Recipe scenery adds about 0.2 ms once its sprites are cached, and drawing a dense screen takes 0.4 ms per frame. A 90 ms bake can show as a hitch when a player crosses into a new screen. Measure in a production build first; if it holds, cache transition tiles by corner pattern or bake off the main path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Baking a generated screen takes under 16 ms in a production build, measured on the same screens
- [ ] #2 Crossing screens shows no dropped frames in a recorded trace
<!-- AC:END -->
