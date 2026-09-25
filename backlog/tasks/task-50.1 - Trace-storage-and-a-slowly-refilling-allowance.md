---
id: TASK-50.1
title: 'Trace storage, allowance, and the inventory bar'
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
updated_date: '2026-09-25 22:53'
labels: []
milestone: m-5
dependencies: []
parent_task_id: TASK-50
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The foundation for every kind of trace. Store traces per screen position, separate from the generated screen record, so the server sends them with a screen and every player on it sees changes live. Give each player a per-kind allowance that refills slowly (for example one sign a day, a few cairn stones a day), enforced on the server. The client shows how many of each the player has left and when the next one comes back. Limits live in one table so they are easy to tune.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Traces are stored apart from screen records, survive restarts, and reach every player on the screen without reconnecting
- [ ] #2 Each trace kind has a server-enforced allowance that refills over time; a request past it is refused with the time until the next one
- [ ] #3 The client shows the remaining allowance per kind and when it refills
- [ ] #4 Allowance values for every kind live in one table
- [ ] #5 Stored generator output is unchanged (D23), and a world wipe also clears traces
- [ ] #6 Players have an inventory bar below the game view: a full-width carved panel coloured from the current biome's palette ramps (BIOME_RAMPS), 10 numbered slots on keys 1 to 9 and 0, each with an icon and a count; slot 1 is always signs and greys out at 0, and other stacks shift up when one runs out
- [ ] #7 An item is used on the tile the player faces with its number key, or by clicking its slot and then a tile within reach; while an item is selected the cursor shows its icon and outlines the target tile as valid or invalid; right-click or Esc cancels
- [ ] #8 A hint bar along the bottom edge of the world stays hidden while the player walks and appears after they stand still about half a second, or to show a message; refusals explain why, for example 'Flowers can only be placed on graves', 'Signs go on open ground near a road', 'Too far away. Walk closer.'
- [ ] #9 The faced tile is computed from the centre of the player's collision box, and nothing is placed on a tile that overlaps the player or would leave them no walkable route off the screen, tested over every sub-tile position and facing
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo). Chosen: inventory bar below the view with the carved biome panel; bottom hint bar shown only when stopped; one interact key (E or Space) for using things in the world. Rejected: text prompts while walking (too distracting), floating prompts over targets (covered the player), worn footpaths (dropped, TASK-50.5 archived). The demo found a trap when facing south: the faced tile came from a point above the feet, so a sign could land on a tile the player stood on.
<!-- SECTION:NOTES:END -->
