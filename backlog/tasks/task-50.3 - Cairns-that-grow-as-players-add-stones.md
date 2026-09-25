---
id: TASK-50.3
title: Movable rocks and cairns
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
updated_date: '2026-09-25 23:32'
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
Rocks become things players move around the shared world. Picking up a loose rock takes it out of the world and into the player's inventory bar; dropping it puts it back on any open tile, where every player sees it. Placing a rock on top of another loose rock starts a cairn, and cairns grow as more players add stones, so a tall cairn marks a place many people have passed. Rocks are conserved: nothing creates new ones, so moving them around cannot clutter the world. Generated rocks stay in the stored screen record (D23); taking one away is recorded as a trace on top of it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 E on a loose rock (a generated rock or a dropped one, not a stone in a cairn) removes it from the world for every player and puts a stone of its material in the inventory bar, up to a carry limit of 3; stones stack by material, and moss does not come with the stone
- [ ] #2 Using a stone on an open walkable tile away from roads drops it there as a loose rock that every player sees; roads, water, and tiles that would block a road or trap a player are refused with a reason in the hint bar
- [ ] #3 Stones in a cairn stay put: only loose single rocks can be picked up
- [ ] #4 A cairn holds at most 12 stones; a full cairn is marked complete, refuses more stones with 'This cairn is complete', and shows its stone and builder counts up close
- [ ] #5 Each stone in a cairn is drawn from the world rock recipe in its own material, so players recognise the stones they carried; the cairn reads as one object, with one outline around the silhouette, a dark seam between stones and the style guide's light direction, within the per-sprite colour limit
- [ ] #6 Every count from 1 to 12 has its own fixed layout that looks like a cairn: 1 is a single world-sized rock, 2 is two stacked, 3 is a pyramid of two with one on top, then a wider base and a centred, tapering stack up to a capstone at 12, about 1.5 tiles wide and high; stones may be re-seated as the count grows
- [ ] #7 Each added stone makes the outline grow or visibly changes it, and the 2-stone cairn does not read as a headstone
- [ ] #8 Removed generated rocks are stored as traces, so stored screen records stay unchanged (D23), and rock and cairn sprites are recipes that pass pnpm lint:art
- [ ] #9 Using a stone on a loose rock makes a 2-stone cairn and using one on a cairn adds to it, with no per-player limit: one player may build a whole cairn alone
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo).

Changed after the demo: cairns use the inventory bar like flowers. Stones are picked up from rocks and placed, instead of added through a hint-bar prompt with a daily stone allowance.

Cairn drawing settled in the demo as variant a4 (_local/traces-demo, local only): real rock-recipe stones with their own outline removed, re-seated in a fixed layout per count, one outline for the whole cairn. Rejected: random pebble piles (messy, one outline per stone), brick courses filled bottom-up (looked like masonry, and stages 2 to 4 looked like a kerb), one-object shading (hid which stone was which material), a wide mound (rubble heap). Open in the demo: stages 4 and 5, and 9 and 10, share a size, and stage 2 looked a little like a headstone.

Changed after the demo: a cairn is no longer started from nothing. Picking up a rock removes it; a dropped stone becomes a loose rock anywhere open; a stone placed on a loose rock starts a cairn. The daily new-cairn limit is gone because rocks are conserved. Defaults chosen: rocks do not respawn, stones in a cairn cannot be taken, carried stones lose their moss.

Per-player cairn limits removed on 2026-09-25: rocks are conserved, so stacking cannot spam the world, and someone who enjoys stacking rocks should be free to. The builder count shown up close stays honest.
<!-- SECTION:NOTES:END -->
