---
id: TASK-50.3
title: Cairns that grow as players add stones
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
labels: []
milestone: m-5
dependencies:
  - TASK-50.1
parent_task_id: TASK-50
priority: medium
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Any player can add one stone to a cairn, or start a new one on open ground away from roads. A cairn grows through visible stages as more players add to it, so a tall cairn marks a place many people have passed. Adding a stone uses the cairn allowance; a player can add to the same cairn only once.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A player can start a cairn or add one stone to an existing one, within their allowance and at most once per cairn
- [ ] #2 A cairn shows at least four visible size stages based on its stone count, and the count is visible up close
- [ ] #3 Cairn sprites are recipes that pass pnpm lint:art
- [ ] #4 Cairns never block a road or trap a player
<!-- AC:END -->
