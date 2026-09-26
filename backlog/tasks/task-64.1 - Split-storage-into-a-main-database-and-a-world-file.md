---
id: TASK-64.1
title: Split storage into a main database and a world file
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 15:45'
updated_date: '2026-09-26 16:26'
labels: []
dependencies: []
parent_task_id: TASK-64
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move deployment-wide data (users, sessions) into a main SQLite database and everything that belongs to the world (seed, screens, visits, traces, trace reports, player positions, inventories) into a separate world SQLite file. The game still runs one shared world after this task, so behaviour does not change; this is the storage seam the per-player worlds task builds on. See decision-25.

This is a one-time reset (D25): both schemas start fresh instead of carrying the old migration history, and the existing dev database is not migrated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The server opens a main database and one world file, each with its own migration list, and each migrates on open
- [x] #2 No foreign key crosses files; world tables store user ids as plain integers, and `users.id` is never reused after a user is deleted
- [x] #3 Signup, login, avatar, play, map, traces, epitaphs, and landmark names work as before (unit and e2e suites pass)
- [x] #4 Admin scripts (`world:wipe`, epitaph admin, names) act on the world file
- [x] #5 Tests and fixtures that exist only to upgrade the old single-file database are removed or rewritten for the new world schema
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. db.ts: branded MainDb and WorldDb types; openMainDatabase(path) with one fresh migration (users with AUTOINCREMENT and avatar_chosen, sessions); openWorldDatabase(path, { upgradeRecords }) with one fresh migration (world seed, screens, player_state, visits, traces, trace_reports, inventories, no foreign keys), then ensureGarden and the D23 record lift. Shared migrate(db, list). Delete openDatabase.
2. paths.ts: DATA_DIR (default ./data relative to apps/server), main.db and worlds/<id>.db; SHARED_WORLD_ID = 1 until TASK-64.2 adds the registry.
3. users.ts and sessions.ts take MainDb; world.ts, chunks.ts, traces.ts, epitaphs.ts, names.ts, map.ts, inventory.ts, wipe.ts take WorldDb. createGame no longer calls ensureGarden (open does).
4. app.ts: createApp({ db, world, game }) so /api/map reads the world file. main.ts opens both, flushes and closes both. Admin scripts open the shared world file under DATA_DIR; wipe keeps its shape.
5. Tests: rewrite db.test.ts for the two files (migrate once on open, AUTOINCREMENT never reuses an id, no FK in world tables, record lift on open, unliftable record blocks open unless skipped); delete legacy.test.ts, fixtures/world-v3.sql, the v3 fixture test in play.test.ts and the layerless upgrade test in world.test.ts; other tests build User values directly (testing.ts) instead of inserting into a users table in the world file.
6. e2e: playwright.config sets DATA_DIR to a tmp dir (E2E_DATA_DIR shared with workers); helpers open main.db and worlds/1.db; teleport opens both itself.
7. .env.example and README scripts table: DATA_DIR replaces DB_PATH.
8. Verify: pnpm typecheck, lint, format:check, test, e2e; start the real server with DATA_DIR in tmp, sign up two users with curl, confirm main.db and worlds/1.db exist.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shape: db.ts exports branded MainDb and WorldDb (both DatabaseSync underneath) so a query against the wrong file fails typecheck. openMainDatabase(path) runs one migration (users with AUTOINCREMENT, sessions). openWorldDatabase(path, { upgradeRecords }) runs one migration (world seed, screens, player_state, visits, traces, trace_reports, inventories, no REFERENCES anywhere), then ensureGarden, then the D23 record lift; createGame no longer calls ensureGarden. paths.ts holds DATA_DIR (default ./data relative to the cwd, as DB_PATH was), main.db, worlds/<id>.db and SHARED_WORLD_ID = 1, which TASK-64.2 replaces with the registry. createApp takes { db, world, game } so /api/map reads the world file. Admin scripts open worlds/1.db under DATA_DIR. DB_PATH is gone everywhere (.env.example, playwright.config.ts, README).

Removed: legacy.test.ts, fixtures/world-v3.sql, the v3 fixture test in play.test.ts, the layerless-schema upgrade test in world.test.ts, and both old-migration tests in db.test.ts (D25: one-time reset, no migration of the old single file). db.test.ts now proves: both files migrate once and reopen as they are in WAL mode with foreign keys on; each world file rolls its own seed; a deleted account never gives its id to a later one; world tables have no foreign keys and hold state for any user id; a v3 record is lifted when the world opens; an unliftable record stops the open unless the wipe skips the lift. Tests that only need a User build one with testing.ts userNamed(id, name) instead of inserting into a users table that no longer lives in the world file.

e2e: playwright.config.ts sets DATA_DIR to a tmp dir shared with workers as E2E_DATA_DIR; helpers export mainDb() and worldDb(); teleport(page, user, coord, at) opens both itself. wake.spec 'reloading within the timeout' evaluated exploreState before the reloaded page had defined it (page snapshot showed the game view logged in), failing in two full runs while passing 4/4 alone; it now waits for exploreState after the reload, the same pattern map.spec uses for exploreMap.

Doc follow-up left for TASK-65 / parent AC #4: doc-2 D23's last paragraph still names legacy.test.ts and the v3 fixture as guards; doc-1 Server section still lists one table set.

Verification: pnpm typecheck (0 errors), pnpm lint (clean), pnpm format:check (clean), pnpm test (931 unit tests + 1 perf test passed, 55 files), pnpm e2e (28 passed). Real server: DATA_DIR=<tmp> PORT=4399 node apps/server/src/main.ts, two curl signups (ann id 1, ben id 2), /api/me answered for each cookie, /api/map 200, files created: <tmp>/main.db and <tmp>/worlds/1.db. Admin scripts against that DATA_DIR: pnpm names ('No landmark has a name yet.'), pnpm epitaphs ('No grave has an epitaph yet.'), pnpm world:wipe without --yes refuses, with --yes 'Wiped <tmp>/worlds/1.db: removed 1 screen ... The secret garden is back.'; DATA_DIR=/tmp/nowhere pnpm names exits 1 with the DATA_DIR hint.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Storage is split into a main database (users, sessions) and a world file (seed, screens, positions, visits, traces, reports, inventories), each with its own fresh single migration, opened by openMainDatabase and openWorldDatabase in db.ts and typed apart as MainDb and WorldDb. DATA_DIR replaces DB_PATH, with main.db and worlds/1.db (the one shared world until TASK-64.2). Old single-file upgrade tests and the v3 fixture are gone; db.test.ts covers the two files, AUTOINCREMENT ids, the absence of cross-file foreign keys, and the record lift on open. Verified with typecheck, lint, format:check, 931 unit tests, 28 e2e tests, a real server run with two signups producing main.db and worlds/1.db, and the three admin scripts against that directory.
<!-- SECTION:FINAL_SUMMARY:END -->
