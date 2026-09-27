---
id: TASK-71
title: Failed or refused travel leaks a room and freezes the client
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 14:12'
updated_date: '2026-09-27 16:06'
labels:
  - server
  - client
  - protocol
dependencies: []
references:
  - apps/server/src/play.ts
  - apps/server/src/presence.ts
  - apps/web/src/game/game.ts
  - packages/core/src/travel.ts
priority: high
type: bug
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`travel()` in `apps/server/src/play.ts` calls `roomAt()` before it checks `seamOpenings`. When the seam has no opening it sends `correct` and returns, but the room it created has no players and stays in `Presence` forever (rooms are only deleted in `exit`). That screen's place is never reloaded, so `settle` and admin edits (epitaphs, names) never reach it until the whole world idles out.

Any exception inside `travel` or `connect` (for example `arrivalPose` throwing "has no walkable position", a generation failure, or a DB lock in `recordVisit`) is caught and logged by `@hono/node-ws` and nothing is sent to the client. `travel` also mutates presence (`exit`, room swap, `sendScreen`) before its fallible writes, so a throw can leave the player in no room. The client (`apps/web/src/game/game.ts`) sits in `travelling` or "Connecting…" forever: that phase only leaves on `screen` or `correct` and has no timeout.

Found by the multi-model architecture review (2026-09-27); raised independently by all three reviewers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A refused travel leaves no empty room cached in Presence
- [x] #2 An error during travel or connect leaves server presence consistent (the player is in exactly one room, or cleanly disconnected)
- [x] #3 An error during travel or connect sends the client a reply it recovers from, instead of silence
- [x] #4 The client leaves the travelling state after a bounded time even if the server never answers
- [x] #5 Server tests drive travel into a refused seam and into a throwing arrival and assert the outcomes above
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Red: server tests for a refused seam (stored walled screen east of the garden; a trace written after the refusal must reach the next arrival), a travel whose DB write fails (query_only), and a connect whose DB write fails; e2e test that drops the client's travel message and expects the client back in play.
2. Green: Presence keeps a room only once someone enters it. travel and connect do their DB writes (recordVisit, save) before moving the player between rooms. The WS handlers in app.ts log a throw and close with 1011 so the client reconnects and resumes. Client game loop leaves travelling after 5 s with no answer.
3. Gates, full e2e under the lock, deslop, no-comments, PR stacked on TASK-70.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PR https://github.com/geekitycom/explore/pull/5 (branch fix/task-71-travel-failures, head e91e602, base fix/task-70-sqlite-busy-timeout). Red: stale place after refused seam (probe missing), no 1011 close on failing travel/connect, e2e phase stuck at 'travelling'. Green: rooms registered on enter only (Presence.roomOrLoad), DB writes before presence changes, WS boundary closes 1011, client 5 s travel timeout. Mutation: writes moved back after presence.exit makes the travel test fail ('leave' instead of 'correct'). Gates pass; pnpm e2e 36 passed.

Verified: refused-seam test (trace after refusal did not reach next arrival before the fix), query_only write failures on travel and connect now close with 1011, e2e drops the travel frame and the client returns to playing. Reordering writes after presence.exit makes the travel test fail. Full e2e passed 36/36 on the lane; CI green on PR #5.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Presence registers a room only on enter (roomOrLoad), travel and connect do their database writes before touching presence, socket handler errors close with 1011 so the client reconnects and resumes, and the client leaves travelling after 5 s without an answer. Verified by server tests red before the fix and a new e2e spec; merged in PR #5.
<!-- SECTION:FINAL_SUMMARY:END -->
