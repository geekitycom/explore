---
id: TASK-50.3
title: Cairns that grow as players add stones
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
updated_date: '2026-09-25 22:57'
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
Players pick up a stone from rocks in the world and carry it in the inventory bar, then place it on a cairn to add to it, or on open ground away from roads to start a new one. A cairn grows through visible stages as more players add to it, so a tall cairn marks a place many people have passed. Carrying is the main limit: a player holds at most a few stones, can add only one stone to any given cairn, and can start only one new cairn a day.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 E on a rock puts a stone in the inventory bar, up to a small carry limit (for example 3); the rock stays for other players
- [ ] #2 Using a stone on a cairn adds it, at most once per player per cairn; used on open ground away from roads it starts a new cairn, at most one new cairn per player per day; other targets are refused with a reason in the hint bar
- [ ] #3 A cairn shows at least four visible size stages based on its stone count, late stages have a wide base rather than a column, and the count is visible up close
- [ ] #4 Stone and cairn sprites are recipes that pass pnpm lint:art
- [ ] #5 Cairns never block a road or trap a player
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo).

Changed after the demo: cairns use the inventory bar like flowers. Stones are picked up from rocks and placed, instead of added through a hint-bar prompt with a daily stone allowance.
<!-- SECTION:NOTES:END -->
