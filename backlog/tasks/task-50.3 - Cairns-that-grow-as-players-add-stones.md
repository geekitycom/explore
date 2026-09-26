---
id: TASK-50.3
title: Movable rocks and cairns
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 21:47'
updated_date: '2026-09-26 01:29'
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
- [x] #1 E on a loose rock (a generated rock or a dropped one, not a stone in a cairn) removes it from the world for every player and puts a stone of its material in the inventory bar, up to a carry limit of 3; stones stack by material, and moss does not come with the stone
- [x] #2 Using a stone on an open walkable tile away from roads drops it there as a loose rock that every player sees; roads, water, and tiles that would block a road or trap a player are refused with a reason in the hint bar
- [x] #3 Stones in a cairn stay put: only loose single rocks can be picked up
- [x] #4 A cairn holds at most 12 stones; a full cairn is marked complete, refuses more stones with 'This cairn is complete', and shows its stone and builder counts up close
- [x] #5 Each stone in a cairn is drawn from the world rock recipe in its own material, so players recognise the stones they carried; the cairn reads as one object, with one outline around the silhouette, a dark seam between stones and the style guide's light direction, within the per-sprite colour limit
- [x] #6 Every count from 1 to 12 has its own fixed layout that looks like a cairn: 1 is a single world-sized rock, 2 is two stacked, 3 is a pyramid of two with one on top, then a wider base and a centred, tapering stack up to a capstone at 12, about 1.5 tiles wide and high; stones may be re-seated as the count grows
- [x] #7 Each added stone makes the outline grow or visibly changes it, and the 2-stone cairn does not read as a headstone
- [x] #8 Removed generated rocks are stored as traces, so stored screen records stay unchanged (D23), and rock and cairn sprites are recipes that pass pnpm lint:art
- [x] #9 Using a stone on a loose rock makes a 2-stone cairn and using one on a cairn adds to it, with no per-player limit: one player may build a whole cairn alone
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Data shape: one trace kind 'rock' (traces/kinds/rock.ts) keyed per tile with stack: {stone: RampName, by?: userId}[] (0..12). [] hides a taken generated rock; 1 is a loose rock; 2..12 is a cairn. A generated rock counts as a 1-stack of its FLORA species material with no builder. Item {kind:'rock', variant: material}, carry limit 3.
2. interact: pick up a 1-stack (trace goes to [] over a generated rock, else dropped); refuse on cairns. carry.use: add to a 1..11 stack (start/grow cairn), refuse at 12 ('This cairn is complete.'), else drop on open walkable ground with no road or water corner and no other trace; world rules (edge, split, boxes) come from resolve().
3. Recipe family 'cairn' {stones: RampName[]}: rock() split into body + outline; each stone is a rock body (no moss, no outline) at a fixed seat per count (x, row, size), dropped onto the rows below; later stones seam the earlier ones dark; one outline and shadow; per-material shade merging keeps the sprite within 8 colours.
4. Bubble shows stone and builder counts; full cairn marked complete.
5. Tests: kind rules through resolve(), recipe stages 1..12 style lint and growth. Gallery section 'cairns'. e2e + screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo).

Changed after the demo: cairns use the inventory bar like flowers. Stones are picked up from rocks and placed, instead of added through a hint-bar prompt with a daily stone allowance.

Cairn drawing settled in the demo as variant a4 (_local/traces-demo, local only): real rock-recipe stones with their own outline removed, re-seated in a fixed layout per count, one outline for the whole cairn. Rejected: random pebble piles (messy, one outline per stone), brick courses filled bottom-up (looked like masonry, and stages 2 to 4 looked like a kerb), one-object shading (hid which stone was which material), a wide mound (rubble heap). Open in the demo: stages 4 and 5, and 9 and 10, share a size, and stage 2 looked a little like a headstone.

Changed after the demo: a cairn is no longer started from nothing. Picking up a rock removes it; a dropped stone becomes a loose rock anywhere open; a stone placed on a loose rock starts a cairn. The daily new-cairn limit is gone because rocks are conserved. Defaults chosen: rocks do not respawn, stones in a cairn cannot be taken, carried stones lose their moss.

Per-player cairn limits removed on 2026-09-25: rocks are conserved, so stacking cannot spam the world, and someone who enjoys stacking rocks should be free to. The builder count shown up close stays honest.

Defaults chosen: one trace kind 'rock' per tile whose stack is [] (a generated rock taken), 1 stone (loose rock) or 2..12 (cairn); a generated rock a cairn is started on becomes its unbuilt bottom stone. Drops are refused on any tile with a water corner ('It would sink.'), a road corner ('Keep the road clear.'), a blocking feature or another kind's trace ('Something is in the way.'); edge, split and standing players come from resolve(). Stones are named Fieldstone, Granite, Sandstone. Cairn art: rows of seats per count (1; 1+1 off-centre; 2+1; 3+1; 3+2; 3+2+1; 4+2+1; 4+3+1; 4+3+1+1; 4+3+2+1; 4+3+2+1+1; 4+3+2+2+1); each stone drops onto the rows below and sinks a pixel so its dark underside is the seam; side-by-side stones get a dark seam on the stone behind; closed gaps fill with the seam shade; a mixed cairn merges the closest shades within one material, seam shade last, to stay within 8 colours. The e2e seeds stones into the inventories table (E2E_DB_PATH, now shared with workers by playwright.config.ts) because nothing grants stones in the garden.

Verification: pnpm lint, typecheck, format:check, lint:art, test (605), e2e (14 incl. e2e/cairn.spec.ts). AC1-3,9: kinds/rock.test.ts through resolve() (highlands rock gives granite, carry limit 3, stacking by material, drop/refusals/split, cairn stays put, one player builds 12, complete refusal) and cairn.spec.ts in the browser. AC4: bubble test ('Complete cairn: 12 stones, 4 builders'). AC5-7: recipes/cairn.test.ts (style lint for all counts, materials, mixes and seeds; each material keeps two shades in a 3-material cairn; every added stone changes the silhouette and covers more pixels; stage 2 wider than a headstone; 12 about 1.5 tiles). AC8: rock.test.ts asserts the screen record is untouched after a pick-up; lint:art passes. Screenshots: e2e/.results/cairn-stones-in-bar.png, cairn-pick-up.png, cairn-mixed.png, cairn-mixed-view.png, cairn-gallery.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rocks are now movable traces. Core: kind 'rock' (packages/core/src/traces/kinds/rock.ts) stores the stones on a tile; E picks up a loose or generated rock as a stone of its FLORA material (carry 3, stacks by material, no moss), a stone drops on open ground away from roads and water, onto a loose rock it starts a cairn and onto a cairn it adds a stone, up to 12 ('This cairn is complete.'); stones in a cairn stay put; the bubble shows stone and builder counts. Taking a generated rock stores an empty stack that hides the feature, so screen records never change (D23). New recipe family 'cairn' (recipes/cairn.ts) builds each stage from real rock bodies in their own materials with one outline, seams and a per-material shade budget; rock.ts split into rockBody + outline. Web: gallery section 'cairns' (1 to 12, three materials and mixed). Verified with lint, typecheck, format:check, lint:art, 605 unit tests and 14 e2e specs including e2e/cairn.spec.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
