---
id: TASK-64.3
title: Open your world for visitors
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 15:45'
updated_date: '2026-09-26 17:52'
labels: []
dependencies:
  - TASK-64.2
parent_task_id: TASK-64
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Worlds are closed by default. The owner can switch their world to "open for visitors", which shows a short, easy-to-type code. The code is not single use: anyone logged in who has it can join while the world stays open, so a kid can share it in a group chat and several friends can come in. Meant for friends and family the owner chooses, never strangers.

Visitors can only be in a world while its host is there and it is open. It closes to visitors when the owner closes it, logs out, their play session ends (`SESSION_TIMEOUT_MS`, D24; a reload or brief disconnect within the timeout does not end it), or the owner goes to visit another world. When it closes, every visitor is sent back to their own world with a short message saying why. Opening it again gives a new code.

A visitor arrives in the host's secret garden and can walk anywhere in the host's world. While visiting, their position, traces, and inventory are stored in the host's world and stay there when they go home (D25).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A world is closed to visitors by default, and no code joins a closed world
- [x] #2 The owner can open their world from inside the game and sees a short, easy-to-type code; they can close it again
- [x] #3 Several players can join with the same code while the world is open
- [x] #4 A visitor arrives on a random walkable tile in the host's secret garden that no other player (host or visitor) is standing on
- [x] #5 A visitor can walk anywhere in the host's world, and screens they explore are added to the host's world and map
- [x] #6 The map shows where each player in the world is, host and visitors alike
- [x] #7 An unknown code or a closed world is refused with a friendly message
- [x] #8 A visitor can go back to their own world; items they picked up while visiting stay in the host's world, and their home world is unchanged by the visit
- [x] #9 There is no way to find or join a world without its current code
- [x] #10 The world closes to visitors when the owner closes it, logs out, their session ends, or they go to visit another world; a code from an earlier opening no longer works
- [x] #11 When the world closes, every visitor in it is sent back to their own world at once, with a short message saying the host closed their world
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Shape. Core protocol: the screen message's wake boolean becomes arrival: 'none' | 'wake' | 'visit' (a sum, since a visitor's fresh arrival is neither a resume nor a wake-up), plus { t: 'sentHome', reason } and SENT_HOME_CLOSE_CODE 4001. Server visitors.ts: per-world Opening = { state: 'closed' } | { state: 'open', code, host: { id, name }, admitted: Set<userId>, openedAt }, held in memory by createOpenings (open is idempotent while open; close then open gives a new code; redeem admits and returns the world; codes unique among open worlds; alphabet ABCDEFGHJKMNPQRSTUVWXYZ, 5 letters, input uppercased with spaces stripped). worlds.ts: admission(db, visitors, user, worldId): 'owner' | 'visitor' | undefined replaces mayEnter (owner OR admitted in the current opening).
2. Host. host.ts owns the openings and per-player session continuity (sessions: Map<userId, { since, lastSeen }> fed by connect, flush, disconnect). One close path closeToVisitors(worldId): ends the opening and has the game send every non-host player { t: 'sentHome', reason } then close their socket; idempotent. Triggers: DELETE endpoint, logout, sweep finding the host with no connection anywhere for sessionTimeoutMs, the host connecting to another world, idle close of the world. A restart closes every world to visitors (in memory; acceptable).
3. Game. play.ts connect(user, conn, { role, sessionSince }): resume iff the saved position is from this session (seenAt >= since - timeout); a fresh visitor arrives on a random walkable garden tile nobody stands on (arrival.ts visitorPose, injected random) with arrival 'visit'; a fresh owner wakes at GARDEN_SPAWN. arrive(player, arrival) is the server arrival hook; sendHome(player, reason) the departure hook. roster() feeds the map and the host.
4. API. GET/POST/DELETE /api/worlds/:id/visitors (owner only): read, open (returns { code }), close. POST /api/visits { code } (rate limited per user and per address, reuse rate-limit.ts) -> { world: { id, host } } or 404 unknown_code with a friendly message. Map JSON gains players (everyone online, world tiles, display names). Logout closes the caller's world to visitors.
5. Client. URL is the source of truth: /worlds/:id (and /worlds/:id/map) means visiting; reload keeps the visit; Go home pushes /. api.ts wrappers; net.ts treats the sent-home code as terminal; state.ts maps arrival to the phase; game.ts startGame takes an options object with onArrive(arrival) and onSentHome(reason) hooks (TASK-67 attaches the portal there); hands.say gains a duration so the arrival line 'You arrive in <host>'s world.' and the sent-home notice stay readable. New ui/friends.ts dialog from a Friends game-bar button: Open for visitors (big code, Close to visitors), Visit a friend (code input, friendly refusals); a Go home bar button while visiting. Map draws every player as a dot with their display name.
6. Tests. Unit: visitors (state machine, alphabet, uniqueness, schema), arrival (property over seeds: never on an occupied tile, always standable), worlds admission, host (sweep timeout with injected clock, connect elsewhere closes, idempotent close, visitor state and inventory stay in the host file, coming home within the session resumes), app/play (open -> code -> join -> both see each other and the map lists both; unknown code; old code refused after reopen; close and logout send home; rate limit; non-owner cannot open), client state/hint/map-view. e2e: restore the two fixme tests with the real flow; visitors.spec covers join and map, old code refused after reopen, close sends home with the message, logout sends home, going home resumes where you stood.
7. Verify: pnpm typecheck, lint, format:check, test, e2e; then a throwaway Playwright script against a built server with a tmp DATA_DIR (two browsers) with screenshots. Small conventional commits per green unit.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shape. Core protocol: the screen message's wake boolean became arrival: 'none' | 'wake' | 'visit' (a visitor's fresh arrival is neither a resume nor a wake-up), plus { t: 'sentHome', reason } and SENT_HOME_CLOSE_CODE 4001. Server visitors.ts: Opening = { state: 'closed' } | { state: 'open', code, host: { id, name }, admitted: Set<userId>, openedAt }, held in memory by createOpenings (open is idempotent while open; close then open gives a new code and the old one stops working; redeem admits and returns the world; codes unique among open worlds; alphabet ABCDEFGHJKMNPQRSTUVWXYZ, 5 letters, typed input uppercased with spaces and dashes stripped by visitCodeSchema). worlds.ts admission(db, visitors, user, worldId): 'owner' | 'visitor' | undefined replaces mayEnter; createApp's admit option keeps that signature as the test seam (play.test default () => 'owner', 'real' for the actual rule). host.ts owns the openings and per-player sessions (Map<userId, { since, lastSeen }> fed by connect, flush, disconnect); closeToVisitors(worldId) is the one close path (ends the opening, game.sendVisitorsHome sends every non-host player sentHome first, then disconnects and closes each socket; a no-op when closed). Triggers: DELETE /api/worlds/:id/visitors, POST /api/logout, host.connect to another world, sweep() finding the host with no connection anywhere for sessionTimeoutMs, and the idle close of the world. A restart closes every world to visitors (in memory; accepted). play.ts connect(user, conn, { role, sessionSince }) resumes iff saved.seenAt > sessionSince - timeout (with the default sessionSince = now() this is the old D24 rule, so tests calling game.connect directly are unchanged); a fresh visitor gets arrival.ts visitorPose (random walkable tile whose feet box touches no present player's feet tiles, injected random) and arrival 'visit'; arrive(player, arrival) and sendHome(visitors, reason) are the server hooks for TASK-67; roster() feeds the map (players in world tiles, with you) and the host. API: GET/POST/DELETE /api/worlds/:id/visitors (requireOwner: 403 for a visitor), POST /api/visits { code } -> { world: { id, host } } or 404 unknown_code / 400 validation with kid-readable messages, rate limited by VISIT_LIMITS (10 per account and 30 per address per 15 minutes; a success resets the account's count).

Client. The URL is the source of truth: /worlds/:id (and /worlds/:id/map) means visiting, a reload keeps the visit, Back ends it, Go home pushes /. The host's display name rides in history.state so a reload still knows it. startGame takes an options object with onArrive(arrival) and onSentHome(reason) hooks (TASK-67's portal attaches there); main.ts travelTo/visit/goHome is the one client departure path, used by the Go home button, the Friends dialog, the sentHome message, and a refused socket while visiting (which goes home with a notice instead of a dead status). hint.ts Message gained a duration (until) so 'You arrive in <host>'s world.' and '<host> closed their world, so you're back home.' stay up 6 s. ui/friends.ts: a Friends game-bar button opens 'Play with friends' with Your world (Open for visitors -> big code + Close to visitors) and Visit a friend (Their code -> Go, refusals inline); while visiting, the section says whose world you are in with Go home, and the bar gets a Go home button. The map draws every player as a dot (pink you, blue others) labelled with display names through mapLabels; exploreWorld() and exploreMap().players are test hooks. Decisions taken beyond the brief: 5 letters rather than 4 (23^5 = 6.4M codes; with 30 guesses per address per 15 minutes a brute force does not finish); reopening an already open world keeps its code (a double tap sends nobody home); a visitor's re-visit within the session resumes where they stood in the host's world, by the same rule that brings them home in place.

Verification: pnpm typecheck (3 packages, 0 errors), pnpm lint (clean), pnpm format:check (clean), pnpm test (991 unit tests + 1 perf test, 59 files; main had 949; new: visitors.test 7, arrival.test 3, host.test 9 new, play.test visitors describe 7, app.test visit code guesses 3, worlds.test admission, state.test visit arrival, map-view.test players case), pnpm e2e (33 passed, 0 fixme; main had 27 passed + 2 fixme; the two two-account tests in world.spec and avatar.spec run again through the real flow, and visitors.spec adds 4). Real app: apps/web built, DATA_DIR=<scratchpad>/real/data PORT=4399 node apps/server/src/main.ts, driven by a throwaway Playwright script with two Chrome contexts: Ann signs up, wakes, opens her world (code PTBNQ shown in the dialog); Ben signs up, wakes, types the code in lower case, lands at /worlds/1 on a garden tile away from Ann with 'You arrive in Ann's world.' in the hint bar; both see each other (others lists); Ben's map lists Ann and Ben (you); Ann closes to visitors; Ben is at / within a second, playing, alone, with 'Ann closed their world, so you're back home.'; Ann is alone again. Files on disk afterwards: main.db, worlds/1.db, worlds/3.db. Screenshots: <scratchpad>/real/shots/1-ann-open-for-visitors.png, 2-ben-arrives-in-anns-garden.png, 3-ben-map-shows-both.png, 4-ben-sent-home.png (scratchpad = /private/tmp/claude-501/-Users-andrewshell-code-geekity-explore/2ef025c9-153b-4f86-bc99-d4ec1d229055/scratchpad). Observation, not from this task: world ids skip (Ann 1, Ben 3) because ensureHomeWorld's INSERT ... ON CONFLICT DO NOTHING consumes an AUTOINCREMENT id on every login and /api/me; harmless since ids are opaque.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Worlds open to visitors with a code. The owner opens their world from a Friends dialog in the game bar and reads a five-letter code (no I, L, O); anyone logged in who types it is admitted while the world stays open, arrives on a random free garden tile with 'You arrive in <host>'s world.', can walk anywhere, and leaves their position, traces, and items in the host's world file. One close path (owner closes, logs out, visits someone else, has no connection anywhere for the session timeout, or the empty world closes) sends every visitor home at once with '<host> closed their world, so you're back home.' and hands out a new code next time. admission() is the single access rule, code guesses are rate limited per account and per address, the map shows every player by display name, and the URL /worlds/:id keeps a visit across a reload. Verified with typecheck, lint, format:check, 991 unit tests, 33 e2e tests (the two fixme tests restored), and a scripted two-browser run of the built app with screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
