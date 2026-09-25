---
id: TASK-50.3
title: Cairns that grow as players add stones
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
updated_date: '2026-09-25 23:23'
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
- [ ] #2 A stone keeps the material of the rock it was picked from (for example grey fieldstone, desert sandstone, highland granite; moss stays behind) and stones stack by material in the inventory bar
- [ ] #3 Using a stone on a cairn adds it, at most once per player per cairn; used on open ground away from roads it starts a new cairn, at most one new cairn per player per day; other targets are refused with a reason in the hint bar
- [ ] #4 A cairn holds at most 12 stones; a full cairn is marked complete, refuses more stones with 'This cairn is complete', and shows its stone and builder counts up close
- [ ] #5 Each stone in a cairn is drawn from the world rock recipe in its own material, so players recognise the stones they carried; the cairn reads as one object, with one outline around the silhouette, a dark seam between stones and the style guide's light direction, within the per-sprite colour limit
- [ ] #6 Every count from 1 to 12 has its own fixed layout that looks like a cairn: 1 is a single world-sized rock, 2 is two stacked, 3 is a pyramid of two with one on top, then a wider base and a centred, tapering stack up to a capstone at 12, about 1.5 tiles wide and high; stones may be re-seated as the count grows
- [ ] #7 Each added stone makes the outline grow or visibly changes it, and the 2-stone cairn does not read as a headstone
- [ ] #8 Stone and cairn sprites are recipes that pass pnpm lint:art
- [ ] #9 Cairns never block a road or trap a player
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo).

Changed after the demo: cairns use the inventory bar like flowers. Stones are picked up from rocks and placed, instead of added through a hint-bar prompt with a daily stone allowance.

Cairn drawing settled in the demo as variant a4 (_local/traces-demo, local only): real rock-recipe stones with their own outline removed, re-seated in a fixed layout per count, one outline for the whole cairn. Rejected: random pebble piles (messy, one outline per stone), brick courses filled bottom-up (looked like masonry, and stages 2 to 4 looked like a kerb), one-object shading (hid which stone was which material), a wide mound (rubble heap). Open in the demo: stages 4 and 5, and 9 and 10, share a size, and stage 2 looked a little like a headstone.
<!-- SECTION:NOTES:END -->
