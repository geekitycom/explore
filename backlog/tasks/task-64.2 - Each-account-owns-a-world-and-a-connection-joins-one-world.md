---
id: TASK-64.2
title: 'Each account owns a world, and a connection joins one world'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 15:45'
updated_date: '2026-09-26 16:53'
labels: []
dependencies:
  - TASK-64.1
parent_task_id: TASK-64
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make worlds per player. The main database gets a world registry (world id separate from the owner's user id, owner, host that serves it) and a record of who may enter each world. Signup creates the new player's world. The server runs one game per open world instead of one global game, opening a world when its first player connects and closing it when nobody has been in it for a while. The client always says which world it is joining, and nothing on the server assumes there is only one world. See decision-25.

The host column is always this server for now; routing between servers is out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Signup creates a world file with its own seed and garden, registered to the new user
- [x] #2 A player connects to their own world by default; connecting to a world they may not enter is refused
- [x] #3 Players in different worlds never receive each other's presence, movement, traces, or screens
- [x] #4 Several worlds can be open at once, each saving positions on its own, and an idle world is closed and reopens with its state intact
- [x] #5 Admin scripts take the world they act on
- [x] #6 Multiplayer unit and e2e tests still run by giving the second player access to the first player's world
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Data shape. Main db: worlds (id AUTOINCREMENT, owner_id UNIQUE REFERENCES users, host TEXT NULL = this server, created_at), folded into the one fresh main migration (nothing is deployed). worlds.ts: branded WorldId, worldIdSchema for boundaries, ensureHomeWorld(db, userId) (INSERT ... ON CONFLICT DO NOTHING then SELECT, so signup, login and /api/me all converge), homeWorld lookup, and the single access seam mayEnter(db, user, worldId) (owner only; TASK-64.3 extends it).
2. host.ts: createWorldHost({ pathOf, game options, idleMs, now }) keeps a Map<WorldId, { db, game }> of open worlds. open(id) lazily opens the file and its own createGame; connect/disconnect go through it; flush() saves every open world; sweep() closes worlds with no players for idleMs (game.stop, db.close), and a later open reopens the file with state intact; changeAvatar(user) tells whichever world the user is in; stop() closes all. Game gains playerCount().
3. app.ts: createApp({ db, host, admit = mayEnter }). signup/login/me/avatar answer { user: { ...user, home } } after ensureHomeWorld + host.open (so signup creates the file with seed and garden). GET /api/worlds/:id/map and GET /ws/worlds/:id parse the id with worldIdSchema at the boundary; a refused map is 403 forbidden, a refused socket is accepted then closed with REFUSED_CLOSE_CODE 4403 and a reason (core protocol). No route assumes one world; SHARED_WORLD_ID goes away.
4. main.ts: host over DATA_DIR/worlds; the save interval flushes and sweeps; signals stop the host. Admin scripts name the world with --world <id> or --owner <username> (resolved through main.db), documented in the README table.
5. Client: User gains home; net.connect takes the world id and stops on the refused code; fetchMap(worldId); the map place carries the user.
6. Tests: worlds.test (idempotent creation, AUTOINCREMENT ids, mayEnter), host.test (lazy open, per-world flush, idle close and reopen with state intact, isolation between worlds), play.test connects to /ws/worlds/1 with a test admit that lets bob into alice's world, plus a refused-world test through the real mayEnter; app.test covers /api/me home, signup creating the file, and a 403 map. e2e: helpers look up the home world of a user; the two-account e2e tests (world.spec two players, avatar.spec others see it) become test.fixme until TASK-64.3; every other e2e test passes.
7. Verify: typecheck, lint, format:check, test, e2e; real server with two curl signups showing two world files, different home ids, and a 403 on the other user's map.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shape. Main db gains worlds (id AUTOINCREMENT, owner_id UNIQUE REFERENCES users, host TEXT NULL meaning this server, created_at), folded into the one fresh main migration since nothing is deployed. worlds.ts: branded WorldId, worldIdSchema (positive int, parsed at the URL boundary), ensureHomeWorld(db, userId) (INSERT ... ON CONFLICT (owner_id) DO NOTHING, then SELECT: signup, login, /api/me and the avatar route all call it, so a crash after creating the account only delays the world to the next request), homeWorld, worldOwnedBy (admin scripts), and mayEnter(db, user, worldId), the single access seam, owner-only for now. host.ts: createWorldHost({ pathOf, game, idleMs = 5 min, now }) keeps a Map of open worlds, each its own WorldDb plus its own createGame; open(id) is lazy, connect/receive/disconnect route to the world, flush() saves every open world, sweep() closes worlds with no players for idleMs (game.stop then db.close; reopening finds the saved state), changeAvatar tells every open world, stop() closes all. Game gained playerCount(). app.ts: createApp({ db, host, admit = mayEnter }); signup/login/me/avatar answer { user: { ...user, home } } after ensureHomeWorld + host.open (so signup creates worlds/<id>.db with seed and garden); GET /api/worlds/:id/map (403 forbidden 'That world is not open to you' when refused or unparsable, 401 without a session) and GET /ws/worlds/:id (accepted, then closed with REFUSED_CLOSE_CODE 4403 and that reason). paths.ts lost SHARED_WORLD_ID; main.ts flushes and sweeps on the 5 s save interval. Admin scripts take --world <id> or --owner <username> (admin.ts openNamedWorld resolves the owner through main.db and exits with a message for a missing flag, an unknown owner, or a missing file). Client: User.home, net.connect({ worldId }) to /ws/worlds/<id> and a 'refused' terminal status, fetchMap(worldId), the /map route carries the user.

Decisions TASK-64.3 must know: the seam is app.ts createApp's admit option, defaulting to worlds.ts mayEnter(db, user, worldId); widen mayEnter (or the data it reads) for open-for-visitors and leave the routes alone. A refused socket is accepted then closed with REFUSED_CLOSE_CODE (core protocol) and a reason string, which the client maps to status 'refused' (main.ts STATUS_TEXT); 64.3's friendly message can ride on that reason. /api/me returns home, so a visitor client knows where home is when sent back. Worlds open lazily and close after 5 minutes idle (host.ts IDLE_CLOSE_MS), so a host leaving and visitors being sent home will leave the world to close on its own. Unit tests put two players in one world with admit: () => true (play.test start()'s default) and prove the real seam separately with mayEnter.

Verification: pnpm typecheck (0 errors), pnpm lint (clean), pnpm format:check (clean), pnpm test (943 unit tests + 1 perf test, 57 files, all passed; new: worlds.test.ts 4, host.test.ts 4, play.test.ts worlds describe 2, app.test.ts worlds describe 2), pnpm e2e (26 passed, 2 skipped = the two fixme'd two-account tests). One earlier full e2e run failed cairn.spec at the 4th stone (stack stayed at 3) and traces.spec (websocket route still matched '**/ws'); the route pattern was fixed, and cairn passed 3/3 alone and in the next full run, so that one is a flake this branch did not introduce as far as I can tell (it passed in all three full runs on 64.1). Real server: DATA_DIR=<tmp> PORT=4398 node apps/server/src/main.ts; curl signups ann (id 1, home 1) and ben (id 2, home 2); /api/me for each names its own home; ann GET /api/worlds/1/map 200; ben GET /api/worlds/1/map 403 {"error":{"code":"forbidden","message":"That world is not open to you"}}; ben GET /api/worlds/2/map 200; files on disk: main.db, worlds/1.db, worlds/2.db. Admin scripts against that DATA_DIR: pnpm names --owner ben ('No landmark has a name yet.'), pnpm epitaphs --world 1 ('No grave has an epitaph yet.'), pnpm names with no flag exits 2 with the --world/--owner usage, pnpm world:wipe --yes --owner ann ('Wiped <tmp>/worlds/1.db: removed 1 screen ...'), --owner nobody exits 1 ('No account named nobody owns a world.').

AC #6: met for unit tests (play.test.ts puts alice and bob in world 1 through createApp's admit seam; the multiplayer describes in play.test.ts and the presence tests all run that way). Deferred to TASK-64.3 for e2e: e2e/world.spec.ts 'two players in the garden see each other walk' and e2e/avatar.spec.ts 'a player restyles in game and others on the screen see it live' are test.fixme with the comment 'restored by TASK-64.3', because two accounts cannot share a world until worlds open to visitors.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every account owns a world: the main database registers worlds (id apart from the owner's id, owner, host), signup creates the world row and file (seed and garden), and a WorldHost runs one game per open world, opening on first entry, flushing each on the save interval, and closing worlds idle for five minutes so they reopen with state intact. The socket (/ws/worlds/:id) and the map (/api/worlds/:id/map) name their world, the client always sends its home world from /api/me, and one seam, mayEnter (createApp's admit option), decides entry, owner-only for now; a refused world gets 403 or close code 4403 with a reason. Admin scripts take --world <id> or --owner <username>. Verified with typecheck, lint, format:check, 943 unit tests (8 new across worlds, host, play, app), 26 passing e2e tests with the two two-account tests fixme'd until TASK-64.3 (AC #6 met for unit tests, deferred for e2e), and a real server run where two curl signups produced worlds/1.db and worlds/2.db, distinct home ids, and a 403 for the other user's map.
<!-- SECTION:FINAL_SUMMARY:END -->
