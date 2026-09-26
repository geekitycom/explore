---
id: TASK-50.1
title: 'Trace storage, the inventory bar, and interaction'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-25 21:47'
updated_date: '2026-09-26 00:28'
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

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ground: read play/presence/world/db/wipe (server), game/state/render/main/input/movement (web), walk/travel/codec/protocol/palette/recipes (core).
2. Architect arena (3 runners, cross-judge): synthesized design in the session scratchpad. Shape: Place = screen + traces with derived per-tile walkability; traces keyed by (tile, kind); a traceKind() registry in packages/core/src/traces (fields schema, solid, look, bubble, interact, carry, action, offer, settle, limits); one pure resolve() both server and client run; world rules (reach, box overlap, edge, no-split) applied after the kind; Inventory as ordered stacks with per-kind carry limits from LIMITS; messages interact/use/act and screen(+traces,+inventory)/traces/inventory/refused; tables traces, trace_reports, inventories in one migration; wipe clears them.
3. Core unit: place.ts, walk.ts rules (boxCentre, facedTile, inReach, wayIfSolid), traces/*, probe test kind, protocol, tileHash to core; tests incl. every sub-tile position and facing.
4. Server unit: TraceStore, perform, inventory, presence.tell, play.ts cases, migration, wipe; play.test.ts end to end via the probe kind.
5. Web unit: state reducer, hands (selection, cursor, outline), hint bar timing, inventory bar (carved biome panel, 10 slots), render outline and bubbles, input keys.
6. Verify: lint, typecheck, test, format:check, e2e with a new traces spec and screenshots in two biomes; land on main; confirm CI.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Interaction design settled in a throwaway demo on 2026-09-25 (local only, _local/traces-demo, not in the repo). Chosen: inventory bar below the view with the carved biome panel; bottom hint bar shown only when stopped; one interact key (E or Space) for using things in the world. Rejected: text prompts while walking (too distracting), floating prompts over targets (covered the player), worn footpaths (dropped, TASK-50.5 archived). The demo found a trap when facing south: the faced tile came from a point above the feet, so a sign could land on a tile the player stood on.

Signs are no longer inventory items or a daily allowance: they come from naming landmarks (TASK-50.2).

Design settled by an architect arena (three candidate designs, one cross-judge). Defaults chosen: traces keyed by (tile, kind) so a grave can hold an epitaph and flowers at once; a solid trace may not go on a screen-edge tile or split the walkable ground, so nobody present, absent or arriving later is ever stranded and the client checks it with no generator data; reach is the 3x3 around the tile holding the centre of the feet box; the faced tile can overlap the player's own box facing east or west and a solid placement there is refused with 'Too close. Step back.'; inventory is its own table (one JSON row per user) and a world wipe clears traces, reports and inventories; a test-only probe kind ships in the registry, nothing in play grants it.
<!-- SECTION:NOTES:END -->
