---
id: TASK-72
title: Server move validation lets players pass through walls
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 14:12'
updated_date: '2026-09-27 16:06'
labels:
  - server
  - core
  - anti-cheat
dependencies: []
references:
  - apps/server/src/play.ts
  - packages/core/src/walk.ts
  - packages/core/src/protocol.ts
priority: high
type: bug
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The server is meant to be the source of truth for movement, but `move()` in `apps/server/src/play.ts` checks only the destination pose against a speed budget (`WALK_SPEED * min(elapsed, 1s) * 1.5 + 4`). After one idle second that is about 112 px, so a client can jump about 7 tiles over hedges, fences, tree rows, water, or trace-built walls.

Separately, the protocol accepts coordinates 32 px past each screen edge (`packages/core/src/protocol.ts`), and `canOccupy` (`packages/core/src/walk.ts`) treats pixels off the screen as open. Poses outside the screen are accepted, broadcast and saved. After a refused travel, the server corrects the player to the off-screen pose they sent, and from there they can walk along the outside of the screen and re-enter past obstacles. A modified client can do this at any edge.

Found by the multi-model architecture review (2026-09-27), Opus and Fable reviewers; both confirmed against source.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The server rejects a move whose path from the last accepted pose to the new one crosses a tile the player cannot occupy
- [x] #2 The server rejects a move whose feet box touches no tile on the screen
- [x] #3 A refused travel corrects the player to a pose on the screen
- [x] #4 Normal play, including walking off an edge to travel, is not refused (existing e2e movement and travel specs pass)
- [x] #5 Server tests cover a jump over a one-tile wall after an idle second, and a walk along the outside of an edge
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Red: server tests (createGame with a set clock) for a jump over a one-tile wall after an idle second, a walk along the outside of the west edge, and a refused travel from a pose past the edge; core test that canOccupy refuses a feet box off the screen.
2. Green: core canOccupy requires the feet box to touch the screen; new core canWalk(place, from, to) checks the x-then-y path one client frame takes, via canOccupy samples. Client step clamps each step so the box keeps touching the screen (exits still fire). Client reports the previous frame's pose first whenever canWalk from the last report fails, so every report is one canWalk from the last. Server move uses canWalk; a refused seam corrects to the pose clamped onto the screen.
3. Property test in movement.test.ts: random honest walks never produce a report canWalk refuses.
4. Gates, full e2e under the lock, deslop, no-comments, PR stacked on TASK-71.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PR https://github.com/geekitycom/explore/pull/7 (branch fix/task-72-move-validation, head ef68ce6, base fix/task-71-travel-failures). Red: wall jump accepted (sent []), outside-edge walk accepted, refused travel corrected to x -3, canOccupy(-5,100) true. Green: core canWalk (x then y, sampled canOccupy) on the server; canOccupy needs the feet box on screen; step clamps with clampFeetOntoScreen; client reports the previous frame when canWalk from the last report fails; refused seam clamps pose onto the screen. Property test: 50k random frames all pass canWalk; fails if step moves y before x. Gates pass; full pnpm e2e 36 passed (two earlier full runs each had one different flake in traces/touch specs, which passed 3/3 alone).

Verified: wall jump after an idle second and a walk along the outside of an edge are corrected; refused travel corrects to an on-screen pose; a property test runs 50,000 random frames at 10 to 1000 fps through rocks and every frame passes canWalk (fails if step order or the clamp changes). Full e2e 36/36; CI green on PR #7. Known limit: a player whose feet already overlap a blocked tile cannot walk out, same as the client step before this change.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Client and server share one movement rule from core: canOccupy requires the feet on the screen, canWalk checks the x-then-y path of a frame, and the client reports an intermediate pose when needed so honest players are never corrected. Verified by red-then-green server tests and a client/server agreement property test; merged in PR #7.
<!-- SECTION:FINAL_SUMMARY:END -->
