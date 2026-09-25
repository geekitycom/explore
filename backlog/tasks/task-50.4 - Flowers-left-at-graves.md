---
id: TASK-50.4
title: Flowers picked and left at graves
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
updated_date: '2026-09-25 22:55'
labels: []
milestone: m-5
dependencies:
  - TASK-50.1
parent_task_id: TASK-50
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Players pick flowers from the flower patches that grow in the world and carry them to graves (TASK-48.3). The species picked is the species left, so poppies on a tundra grave show that someone carried them from a meadow. Picking is the limit: there is no daily allowance. A picked plant regrows after a couple of days, and picking does not remove it for other players. Each grave holds one set of flowers at a time; they stay fresh for a few days, then wilt, then disappear, and only then can someone leave new ones.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 E on a flower patch adds that species to the inventory bar, stacked by species; the picked plant regrows after a fixed number of days
- [ ] #2 Using flowers on a grave leaves that species there; any other target is refused with 'Flowers can only be placed on graves'
- [ ] #3 A grave with flowers, fresh or wilted, refuses more with 'This grave already has flowers' and the player keeps their bouquet; facing it shows who left them
- [ ] #4 Flowers on a grave show fresh, then wilted, then disappear over a fixed number of days
- [ ] #5 Flower sprites come from the species recipes in FLORA and pass pnpm lint:art
- [ ] #6 A picked plant regrows through visible stages, sprout then bud then full flower, over its regrowth days, and can only be picked again once it is a full flower; each stage is a recipe of the species that passes pnpm lint:art
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo). Flowers in hand do not wilt (a real-time wilt while carrying felt nagging in the demo).
<!-- SECTION:NOTES:END -->
