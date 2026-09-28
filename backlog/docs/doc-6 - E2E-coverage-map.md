---
id: doc-6
title: E2E coverage map
type: specification
created_date: '2026-09-27 19:12'
updated_date: '2026-09-27 19:12'
---

A survey of every e2e test made for TASK-83 on 2026-09-27. It records what each test asserts, which server, core or web test already covers its non-browser behaviour, and whether the test stays as a browser smoke path, shrinks, or goes. The suite took about 182 s of test time over 39 tests. The target is under half of that.

**S** marks server or game-rule behaviour. **B** marks behaviour that needs a real browser: rendering, layout, CSS, DOM dialogs, pointer and touch input, audio, canvas pixels, animation.

| # | Spec and title | What it asserts | Existing coverage of the S parts | Verdict | Time |
| --- | --- | --- | --- | --- | --- |
| 1 | ambience: the garden moves by itself | B: canvas pixels change over time | n/a | keep | 3.1s |
| 2 | ambience: reduced motion holds the world still | B: reduced motion freezes the canvas | n/a | keep | 2.1s |
| 3 | auth: a logged-out visitor lands on login | B: login screen renders | n/a | keep | 0.25s |
| 4 | auth: create-account catches a mistyped password | B: client-side mismatch error, no request sent | n/a | keep | 0.39s |
| 5 | auth: a new player creates an account, chooses an avatar, enters the game | S: signup, avatarChosen, case-insensitive login. B: avatar step, game bar, logout and login | app.test "creates the user wearing the default avatar, not yet chosen"; "saving a profile keeps the name and marks the avatar chosen"; "starts a new session … case-insensitively" | split: keep as the signup smoke | 3.1s |
| 6 | auth: a player who leaves during the avatar step gets it again | S: avatarChosen stays false until saved. B: client routes to the avatar step | app.test as row 5 | split: merge the routing into row 5 | 3.0s |
| 7 | auth: server validation errors appear next to the field | S: field validation messages. B: errors render beside the field | app.test "rejects a username that differs only in case"; "rejects %s with a 400 naming the field"; "gives the same 401 for a wrong password" | split: keep one or two field-error renders | 0.6s |
| 8 | auth: a throttled login shows the wait inline | S: 429 after 10 failures with the wait message | app.test "throttles failed logins for one username from one address until the window passes" | remove | 0.75s |
| 9 | auth: logging out in another tab sends this one to login | B: the client's reaction to close code 4401 | play.test "logging out closes every socket opened with that session" | keep | 2.8s |
| 10 | avatar: a player renames and restyles in game and others see it live | S: profile broadcast and persistence. B: Name & avatar dialog | play.test "shows a saved name and avatar to the same screen and to later arrivals"; host.test "tells whichever world the player is in about a new name and avatar"; web state.test "a profile change renames and restyles that player" | split: keep the dialog on one page, drop the second browser context | 6.1s |
| 11 | avatar: a player renames themselves from the game bar | S: blank name rejected, trimmed, persists. B: dialog error, game-bar text | app.test "rejects an invalid avatar, an empty name…" | split: merge into row 10 | 3.0s |
| 12 | cairn: stones are picked up, carried, put down and stacked | S: use and interact on stones, cairn of six, "Stones in a cairn stay put.", inventory spent | core rock.test and inventory.test only. **No server test sends rock use or interact through the game.** | remove after adding a server test | 5.3s |
| 13 | epitaphs: a grave speaks to a player facing it | S: seed epitaph on model failure, spoken only when faced. B: bubble position | epitaphs.test "keeps the seed epitaph when the model fails"; core epitaph.test "speaks only to a player facing it"; web bubbles.test placement | remove | 3.4s |
| 14 | landmarks: a landmark carries a name from the first visit; anyone may rename or put it back | S: generated name, rename, suggestion, clear, map. B: rename dialog | play.test "lets anyone rename a landmark"; "shows the land's name on the map … put it back"; signs.test suggestion tests; core landmark.test; web naming-dialog.test | split: keep the dialog, drop the second suggestion and the map check | 5.8s |
| 15 | landmarks: a failed suggestion leaves the fields alone; a seventh is refused | S: failure message, seventh press refused. B: dialog alert | signs.test "says so when the model fails, times out or says something unfit"; "refuses a player the seventh press in five minutes" | split: fold one failed suggestion into row 14 | 8.2s |
| 16 | map: the map shows screens players stood on | S: only visited screens. B: map link, /map login redirect | play.test "maps the screens players stood on and where the viewer is, only when logged in" | split: keep the redirect and link round trip | 3.6s |
| 17 | map: the map opens over the game, keeping the music and the connection | B | n/a | keep | 5.3s |
| 18 | map: the map opens on you at one size | B: canvas size, resize, no panning | web map-view.test "centres your screen … same size for 2 or 500 screens" | split: drop the 500-screen injection | 4.2s |
| 19 | mouse: a mouse wakes the player and walks them while held | B | web walk-intent.test (logic) | keep | 3.9s |
| 20 | mouse: a held mouse walks around the pond; double-click walks off an edge | B, plus no server corrections | core route.test; web movement.test "every frame of a routed walk is a move the server accepts"; walk-intent.test | split: keep one double-click off the east edge | 11.9s |
| 21 | sound: music and ambience wait for input, follow the world, settings persist | B | web mood.test (tune choice) | keep | 1.9s |
| 22 | sound: ambience plays on the effects bus | B | n/a | keep | 5.1s |
| 23 | traces: the inventory bar and the hint bar frame the world | B: layout. Client logic: hint timing | web inventory-bar.test; hint.test | split: keep layout, drop the hint timing loop | 5.6s |
| 24 | traces: the inventory bar takes its colours from the biome | B | web inventory-bar.test panelColours | keep | 2.9s |
| 25 | visitors: a friend joins with the code; going home resumes in place | S: redeem, presence, map, resume. B: Friends dialog, hint, Go home | play.test "opens with a code a friend joins by"; host.test "a visit and the walk home are one session" | split: becomes the one visitor smoke | 8.8s |
| 26 | visitors: a visitor comes and goes through a portal (**flaky**) | S: join and depart portals. Client portal timeline | play.test join portal; "a visitor who goes home leaves through a portal the host sees"; web portal.test; state.test | remove | 12.5s |
| 27 | visitors: a reload while visiting shows no portal | S | play.test "a visitor who reconnects comes and goes with no portal"; web state.test | remove | 9.4s |
| 28 | visitors: a code from an earlier opening stops working | S: new code, old code refused, case. B: alert | play.test "refuses a wrong code and a code from before a close"; visitors.test | split: fold one refused-code alert into row 25 | 6.1s |
| 29 | visitors: closing the world sends every visitor home | S: depart with reason. B: notice | play.test "closing sends every visitor home at once with the reason"; host.test | split: fold the notice into row 25 | 8.2s |
| 30 | visitors: logging out sends visitors home | S | play.test "logging out sends visitors home" | remove | 8.1s |
| 31 | wake: a new session opens its eyes on the garden | B: eye animation, keys ignored until Space | play.test "sends the garden on first connect"; web state.test | keep | 2.8s |
| 32 | wake: reloading within the timeout resumes where the player stood | S | play.test "resumes the position without waking when the player reconnects within the timeout" | remove | 3.4s |
| 33 | wake: coming back after the timeout wakes the player in the garden | S | play.test "wakes a player in the garden once their last connection is a timeout old"; host.test | remove | 2.6s |
| 34 | wake: with reduced motion the dark fades | B | n/a | keep | 1.3s |
| 35 | world: two players in the garden see each other walk | S | play.test "shares join, moved, and leave within a screen and nowhere else" | remove | 6.4s |
| 36 | world: walking off an edge opens a new screen that matches on return | S | play.test "stores a screen on first visit and returns the identical screen later"; "lands a traveller just inside the matching edge" | remove | 3.6s |
| 37 | world: a travel the server never answers returns you to play | Client only: `TRAVEL_TIMEOUT_MS` in apps/web/src/game/game.ts. **Not covered.** | web state.test covers only a refused travel | remove after adding a web unit test | 9.2s |
| 38 | touch (ipad): a player on an iPad plays by touch alone | B | core rock.test; web hands.test | keep | 4.9s |
| 39 | touch (ipad): the game fits an iPad in portrait and landscape | B | n/a | keep | 2.9s |

## Where server tests start

- `apps/server/src/testing.ts` exports `openGame(path)`, which runs a game on a world file with a ticking clock and fake connections for alice (1) and bob (2), plus `tempDb`, `atGraveyard`, `fakeModel` and `screenOf`.
- `play.test.ts` has local helpers for a real HTTP and websocket server (`start`, `signup`, `connect`, `walk`, `travelEast`, `probeGarden`, `visitors`, `openWorld`, `redeem`). Move one into `testing.ts` when a new test file needs it.
- `host.test.ts` `setup()` drives a world host with an explicit clock, `flush` and `sweep`.
- `app.test.ts` drives HTTP routes with `app.request`, and rate limits with fake `Date` timers.
