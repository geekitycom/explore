---
id: TASK-48.1
title: 'Fence recipes: wooden, metal and stone, intact and broken'
status: To Do
assignee: []
created_date: '2026-09-25 19:18'
labels: []
milestone: m-4
dependencies: []
parent_task_id: TASK-48
priority: medium
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fences in several styles (for example split-rail and picket wood, wrought-iron metal, dry-stone wall), each with intact and broken or weathered variants. Fences join along a line of tiles, so ends, straight runs and corners must connect cleanly in both axes. Built as recipe families in packages/core/src/recipes with deterministic per-tile variation, and used in world dressing where it fits (for example round town greens, farms, ruins).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Wooden, metal and stone fence styles exist, each with intact and broken variants
- [ ] #2 Fence pieces connect cleanly as horizontal and vertical runs, ends and corners
- [ ] #3 Every variant passes pnpm lint:art and uses only palette ramps
- [ ] #4 Fences appear in generated places where they make sense and never block a road or trap a player
- [ ] #5 The art gallery shows every style and variant
<!-- AC:END -->
