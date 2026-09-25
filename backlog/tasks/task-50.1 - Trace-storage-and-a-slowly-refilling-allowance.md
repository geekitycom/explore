---
id: TASK-50.1
title: 'Trace storage, the inventory bar, and interaction'
status: To Do
assignee: []
created_date: '2026-09-25 21:47'
updated_date: '2026-09-25 23:32'
labels: []
milestone: m-5
dependencies: []
parent_task_id: TASK-50
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The foundation for every kind of trace. Store traces per screen position, separate from the generated screen record, so the server sends them with a screen and every player on it sees changes live. Give players the shared interaction pieces the traces use: an inventory bar for carried things (stones, flowers), a hint bar for prompts and refusals, and one rule for which tile a player faces. Per-kind limits, such as how many stones a player can carry, are enforced on the server and live in one table.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Traces are stored apart from screen records, survive restarts, and reach every player on the screen without reconnecting
- [ ] #2 Per-kind limits (for example the stone carry limit) live in one table and are enforced on the server; a refused request says why
- [ ] #3 Players have an inventory bar below the game view: a full-width carved panel coloured from the current biome's palette ramps (BIOME_RAMPS), 10 numbered slots on keys 1 to 9 and 0, each with an icon and a count; stacks shift up when one runs out
- [ ] #4 An item is used on the tile the player faces with its number key, or by clicking its slot and then a tile within reach; while an item is selected the cursor shows its icon and outlines the target tile as valid or invalid; right-click or Esc cancels
- [ ] #5 A hint bar along the bottom edge of the world stays hidden while the player walks and appears after they stand still about half a second, or to show a message; refusals explain why, for example 'Flowers can only be placed on graves' or 'Too far away. Walk closer.'
- [ ] #6 The faced tile is computed from the centre of the player's collision box, and nothing is placed on a tile that overlaps the player or would leave them no walkable route off the screen, tested over every sub-tile position and facing
- [ ] #7 Stored generator output is unchanged (D23), and a world wipe also clears traces
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo). Chosen: inventory bar below the view with the carved biome panel; bottom hint bar shown only when stopped; one interact key (E or Space) for using things in the world. Rejected: text prompts while walking (too distracting), floating prompts over targets (covered the player), worn footpaths (dropped, TASK-50.5 archived). The demo found a trap when facing south: the faced tile came from a point above the feet, so a sign could land on a tile the player stood on.

Signs are no longer inventory items or a daily allowance: they come from naming landmarks (TASK-50.2).
<!-- SECTION:NOTES:END -->
