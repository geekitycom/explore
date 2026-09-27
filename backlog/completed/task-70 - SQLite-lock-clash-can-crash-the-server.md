---
id: TASK-70
title: SQLite lock clash can crash the server
status: Done
assignee:
  - '@claude'
created_date: '2026-09-27 14:12'
updated_date: '2026-09-27 16:06'
labels:
  - server
  - reliability
dependencies: []
references:
  - apps/server/src/db.ts
  - apps/server/src/main.ts
  - apps/server/src/admin.ts
  - e2e/helpers.ts
priority: high
type: bug
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every database opens with `new DatabaseSync(path)` and no busy timeout (`apps/server/src/db.ts` `open()`), so any write that meets another process's write lock throws `database is locked` at once. The admin scripts (`pnpm epitaphs`, `pnpm names`, `admin.ts` `openNamedWorld`) are meant to run against a live server and write to the same world files; even a listing runs migrations and the garden upsert.

The periodic `host.flush()` / `host.sweep()` in `apps/server/src/main.ts` runs in a bare `setInterval`. A lock error there is an uncaught exception, so Node exits and every open world goes down with it. The same unguarded writes sit under WebSocket handlers, where the error is swallowed and state is left half-applied.

Commit 0429d2f hit this clash in e2e and fixed it only in `e2e/helpers.ts` (`timeout: 5000`), not in the server.

Found by the multi-model architecture review (2026-09-27), confirmed by Opus and Fable reviewers.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The server and admin scripts wait for a held write lock for a bounded time instead of failing at once
- [x] #2 A failing save or sweep for one world is logged and does not stop the process or the timer for other worlds
- [x] #3 Running an admin script against a world while the server is saving it does not crash the server (covered by a test)
- [x] #4 The e2e-only lock workaround is removed if the server-side fix makes it unnecessary
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Red: host test where a second process holds a world file's write lock for ~300ms while host.flush() runs; expect the save to land (fails today with 'database is locked'). Host test where one world's save throws; expect flush/sweep/stop not to throw, the error logged, and the other world saved.
2. Green: open() in db.ts passes a bounded busy timeout, shared by server and admin scripts. The world host guards each world's save and close so one failure is logged and the rest proceed; the timer in main.ts no longer sees the throw.
3. Check whether e2e/helpers.ts timeout is still needed (it guards the test's own connection, not the server's).
4. Gates, deslop, no-comments, PR.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
PR https://github.com/geekitycom/explore/pull/4 (branch fix/task-70-sqlite-busy-timeout, head ff8b60d). Red: cross-process lock test failed with 'database is locked'; read-only world test threw 'attempt to write a readonly database' from host.flush. Green: open() passes timeout 5000; host logs per-world save/close failures via logFailure. e2e/helpers.ts timeout kept: it configures the test's own connection, which the server fix cannot cover. Gates: lint, format:check, typecheck, test (1008+1) pass.

Verified: host.test.ts runs a second Node process holding BEGIN IMMEDIATE on the world file; before the fix flush failed with "database is locked", after it the save lands. A read-only world logs its error while the other world saves. The e2e helper timeout stays: it configures the test process own connection, which the server timeout cannot cover (AC 4 condition not met, so nothing to remove). CI green on PR #4.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every SQLite connection now waits up to 5 s for a held lock (db.ts open), and host flush, sweep, close and stop isolate each world behind logFailure, so one world failing to save no longer kills the process or other worlds saves. Verified with a two-process lock test and a failing-world test, both red before the fix; merged in PR #4.
<!-- SECTION:FINAL_SUMMARY:END -->
