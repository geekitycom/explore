---
id: TASK-54
title: Trace bubbles point at their own trace
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 03:13'
updated_date: '2026-09-26 03:19'
labels:
  - web
  - core
  - bug
milestone: m-5
dependencies: []
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
In a graveyard, a player standing between two graves saw the epitaph of the grave below them drawn above them, with its tail pointing at the grave above, so it was unclear which grave the words belonged to (user screenshot 2026-09-25 10.08.33 PM). Bubbles today show for the faced trace else the nearest in reach, and rise above any player name they would cover, which detaches them from their trace. Every trace bubble must sit next to the object it belongs to with its tail on that object, and graves must only speak when faced.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A grave's bubble (epitaph plus any 'left by' flowers line) shows only when the player faces that grave by the interaction faced-tile rule (centre of the collision box); walking past or standing near a grave without facing it shows no grave bubble
- [x] #2 Every trace bubble (graves, signposts, cairns) is drawn beside its trace with the tail on that trace tile: above the trace with the tail down by default, below with the tail up when above would cover the player (the player stands above the trace)
- [x] #3 Bubbles never cover player name labels and stay inside the view: near the top or bottom they flip side, near the left or right edge they shift, and the tail stays on the trace
- [x] #4 Signposts still show when a player walks up to them; cairns follow a documented rule (facing or proximity)
- [x] #5 Unit tests cover: tail on the target tile for every placement, the grave facing rule among adjacent graves in all four directions, below-placement when the player stands above, and edge flips; a test reproducing the reported case fails before the fix
- [x] #6 Screenshots of the fixed case: player above a grave facing down, player below facing up, player beside facing sideways
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: a kind declares where its bubble is read from (readAt: 'reach' default, 'faced'). epitaph and flowers read only from the faced tile (facedTile, the TASK-50.1 rule); landmark and rock keep reach. Cairns: proximity, like signposts, because a cairn is a lone solid pile read on walking up, not one of a row. 2. Web bubbles.ts: BubbleView carries the tail tip (left/top on the target tile's top or bottom edge) and side above|below. Side: above, unless it covers a name or leaves the view, then below; fall back to the side that keeps the reader's own name clear. Horizontal edge anchor stays. 3. CSS: .bubble-below hangs from its tip with the tail on top. 4. Tests: repro (fails before, recorded), tail on tile for every placement, facing among a row of graves in 4 directions, below when reader above, top/bottom flips, name clearance sweep. 5. e2e epitaphs spec: screenshots above/below/beside. 6. lint, typecheck, test, format, e2e; land on main; CI green.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Repro before the fix: bubbles.test 'repro' (graves at (10,7) and (10,5), reader at (10,6) facing west) put the tail tip at y=80, on the grave above (row 5), for the grave at row 7.

Cairns: proximity (readAt reach), like signposts. A cairn is a lone solid pile read on walking up, not one of a row of look-alikes, and its bubble now points at it, so there is no ambiguity to fix by facing.

Placement rule: above the trace, tail tip on the tile's top edge; else below, tip on the bottom edge, when above covers any player's name or leaves the view; if neither side clears every name, the side that clears the reader's own name. A player beside a trace gets it below, since above would cover their name. Default where both rules cannot hold: at the bottom rows (trace row 12 to 14) only above fits, so a reader standing directly above such a grave has their own name covered; staying in view wins. GAP between bubble and name is now 2 world px so a name always fits one side.

Verification: bubbles.test repro failed before the fix (tail tip y=80, on the grave above, for the grave at row 7); epitaph.test facing test failed with the old inReach rule and passes now. pnpm lint, typecheck, format:check, test (679 + 1) pass. pnpm e2e 16/16, including e2e/epitaphs.spec.ts which measures the DOM bubble against the grave tile from beside (below), below (above) and above (below) and checks no bubble before facing. Screenshots: e2e/.results/epitaph-beside.png, epitaph-below.png, epitaph-above.png, landmark-bubble.png.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Trace bubbles now point at their own trace. Core: a trace kind declares readAt ('reach' default, 'faced'); epitaph and flowers are 'faced', so a grave's bubble shows only while the player faces that grave by the interaction faced-tile rule; signposts and cairns stay 'reach'. Web: bubbleViews returns the tail tip on the trace tile's top or bottom edge and a side; the bubble sits above with the tail down, or below with the tail up when above would cover a name (the player above or beside) or leave the view; side-edge anchoring is unchanged. CSS adds .bubble-below with an upward tail. Verified by unit tests (repro, tail on tile from every neighbouring tile across the screen, facing among graves in four directions, flips at the top and bottom, name clearance sweeps), e2e epitaphs spec measuring the real DOM from three sides, and screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
