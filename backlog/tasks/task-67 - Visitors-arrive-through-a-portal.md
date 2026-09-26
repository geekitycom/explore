---
id: TASK-67
title: Visitors arrive and leave through a portal
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 15:56'
updated_date: '2026-09-26 18:29'
labels: []
dependencies:
  - TASK-64.3
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Visitors come and go through a portal instead of simply appearing and vanishing.

Arriving: a small glowing dot appears in the secret garden and opens into a swirling, animated portal. The visitor appears standing in front of it, the portal closes behind them, and the friend is there.

Leaving: when a visitor goes home, or is sent home because the host closed their world, a portal opens next to them, they step into it and disappear, and it closes. Wherever the visitor lands next (their own world), they arrive the same way they normally would there.

Everyone on the screen sees the portal, including the visitor. The portal has a sound: a rising and falling, wheezing, groaning whoosh in the spirit of the TARDIS, made with the game's own synth (D18) rather than a recording, because the real TARDIS sound is the BBC's.

The portal is drawn in code like the rest of the scenery (D21), not taken from an art pack. Arrival placement comes from TASK-64.3 (a random free tile in the garden); the portal needs that tile plus the spot it opens on.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 When a visitor joins, everyone on the garden screen sees a glowing dot open into a swirling portal, the visitor appear in front of it, and the portal close
- [x] #2 The visitor sees their own arrival the same way
- [x] #3 The portal and the arrival tile are both on walkable garden tiles that no player is standing on
- [x] #4 The visitor cannot move until the portal has finished opening and they have appeared, and the whole sequence takes about two seconds
- [x] #5 With reduced motion on, the portal fades in and out without the swirl
- [x] #6 The portal is drawn from code in the game's own visual language (D21) and matches the pixel scale of the garden
- [x] #7 A visitor who goes home, or is sent home when the host closes their world, leaves through a portal that everyone on their screen sees open, take them, and close
- [x] #8 The portal plays a wheezing, rising and falling whoosh made with the game's synth when it opens for an arrival or a departure; it follows the sound settings and is silent when sound is off
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Protocol (core). Arrival becomes { kind: 'none' } | { kind: 'wake' } | { kind: 'visit'; portal: Tile }, so a visit arrival cannot lack its portal. join and leave gain an optional portal: Tile, present only for a real visit arrival or departure (a reload, a walk, or a dropped socket carries none). sentHome becomes { t: 'depart'; portal: Tile; reason?: string } for every departure, with DEPARTED_CLOSE_CODE; clients may send { t: 'goHome' }.
2. Server. arrival.ts visitorArrival(place, taken, random) picks a (portal, pose) pair: the arrival tile and the tile directly north of it (the portal behind, the visitor in front) both standable and free of everyone's feet. departurePortal(place, pose, taken) picks a free walkable neighbour (north first). play.ts: Player records its role; one depart(players, reason?) path sends each leaver depart with its portal, then removes them with leave+portal and closes the socket; sendVisitorsHome and the goHome message (visitors only) both use it. Ordering: the server leaves at once and every client, the leaver included, plays the animation locally from the message; no server timers, and a closed socket does not stop the leaver's render loop.
3. Client model. game/portal.ts: a Portal { kind: arrive|depart, tile, start, traveller: 'you' | PlayerView } and a timeline table (spark, opening, open, closing) with pure functions portalLook(portal, now) (stage, size) and travellerLook(portal, now) (alpha, position), plus canMove. GameState carries portals; applyMessage(state, message, now) adds them from screen/join/leave/depart; the frame loop prunes finished ones, blocks your movement while you are in a portal, and calls onDepart(reason) when your departure portal closes.
4. Art and sound. art/portal.ts draws the portal pixel by pixel on the 16px grid from palette ramps with an outline, a rotating swirl, and a glowing dot; reduced motion draws it static and fades it. audio/whoosh.ts: a TARDIS-like wheeze from the synth's pulse wave and LFSR noise with a pure pitch/filter/gain curve (~2 s, cyclic rise and fall), into the effects bus only when audio is unlocked.
5. Wiring. main.ts Go home button calls game.leave() (sends goHome; goes home at once when the socket is not open); onDepart navigates home with the reason; onPortal plays the whoosh. exploreState exposes portals.
6. Tests. Unit: protocol/state portals (ordinary join/leave gives none), timeline phases and canMove, visitorArrival and departurePortal over many seeds, server depart and goHome, whoosh curve. e2e: visitors.spec asserts the host sees arrive and depart portals, movement is blocked until the visitor appears.
7. Verify: typecheck, lint, format:check, test, e2e; built app with two Playwright contexts, screenshots mid-portal and a WAV rendered through OfflineAudioContext into the scratchpad portal dir; iterate the look.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shape. Protocol: Arrival is now { kind: 'none' } | { kind: 'wake' } | { kind: 'visit'; portal: Tile }, so a visit cannot lack its portal. join and leave carry an optional portal, set only for a real visit arrival or departure; a walk, a reload, or a dropped socket sends none (server test: a visitor who reconnects comes and goes with no portal; e2e: a reload while visiting shows no portal). sentHome became depart { portal, reason? } with DEPARTED_CLOSE_CODE (4001, same number); clients send goHome. Server: arrival.ts visitorArrival picks (pose, portal) with the portal on the tile directly north of the arrival tile, both on-screen, walkable, and free of every present player's feet tiles; departurePortal picks the first free walkable neighbour (n, e, w, s) or the player's own tile. Player carries its role; one depart(players, reason?) path serves the host closing their world and a visitor's goHome (ignored from an owner).

Departure ordering, and why: the server removes the visitor at once (leave with portal to the room, depart to the leaver, then close) and every client plays the animation locally from those messages on its render clock. The leaving client's frame loop outlives its socket, so it shows its own departure, then calls onDepart after the portal closes (about 1.9 s) and main.ts navigates home. The alternative, the server delaying the socket close, needs per-player timers and a half-departed state that a reload or host close would have to handle; this way there is one server path and no timers.

Client model: game/portal.ts Portal { kind, tile, start, traveller: 'you' | PlayerView snapshot } with a PORTAL_STAGES table (spark 300, opening 500, open 500, closing 600 ms; 1.9 s) and pure portalLook (stage, size), travellerLook (shown, along; arrival appears 800 to 1200 ms, departure steps in 800 to 1300 ms), portalDone, youCanMove. GameState.portals is filled by applyMessage(state, message, now) and pruned by the frame loop; movement is skipped while youCanMove is false. The renderer draws a carried traveller faded (and unnamed) between their tile and the portal mouth; with reduced motion the portal draws at full size with a static pattern and fades by alpha, and the traveller fades in place. art/portal.ts draws the portal pixel by pixel at the garden's 16px scale: an upright 14x20 oval with the #141B1B outline, a bright rim, three spiral arms from the water ramp to snow white turning with the clock, and a pulsing two-step glow; the dot is a white core in a cyan cross. The art gallery gained a portal section (art.html?section=portal) with every stage on grass and sand plus reduced motion, which is how the look was iterated (v1 read as a dark egg; v2 is larger with a glowing rim and brighter arms).

Sound: audio/whoosh.ts playWhoosh on the synth's own voices (two detuned narrow pulses, the stepped triangle an octave down, LFSR noise through a band-pass), driven by a pure whooshAt(t) curve: three wheezes over 2 s, each bending pitch up 8 semitones and opening a resonant low-pass, under a fade in and out. main.ts plays it through engine.ifReady on the effects bus whenever a portal opens (arrival or departure, for everyone on the screen), so mute and the effects volume apply and a sound is never queued to play late before audio is unlocked. Offline render (OfflineAudioContext in the browser): peak 0.263, 2.1 s, RMS envelope with three swells.

Also: a second Go home while the portal plays is ignored; the Back button and visiting another friend from inside a visit still leave without a portal (outside the brief).

Verification: pnpm typecheck (0 errors), pnpm lint (clean), pnpm format:check (clean), pnpm test (1006 unit + 1 perf; main had 991), pnpm e2e 35 passed (main had 33; visitors.spec adds the portal test and the reload test). Two earlier full e2e runs each had one different failure outside this work (wake.spec timeout test, then the iPad touch rock test); both pass alone and on repeat (--repeat-each 3 for iPad) and the third full run was 35/35. Real app: built web, DATA_DIR in the scratchpad, PORT 4399, two Chrome contexts (normal and reduced motion) driven by scratchpad/portal/drive.mjs; screenshots in scratchpad/portal/shots (arrive-host-*, arrive-visitor-*, depart-host-*, depart-visitor-*, with -zoom- crops and reduced- variants), gallery rows in scratchpad/portal/v2-row*.png, WAV in scratchpad/portal/whoosh.wav (scratchpad = /private/tmp/claude-501/-Users-andrewshell-code-geekity-explore/2ef025c9-153b-4f86-bc99-d4ec1d229055/scratchpad).

Sound check in the real app (scratchpad/portal/sound.mjs, an analyser tapped on everything reaching the speakers, music volume 0, effects 0.7): the host's output peaked at 0.026 RMS from the garden's ambience before Ben arrived and 0.066 during his portal; with sound muted it stayed 0.0000 before and during.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Visitors now come and go through a portal that everyone on the screen sees, the visitor included. Arriving, a glowing dot opens into a swirling pixel-art portal on a free tile, the visitor steps out onto the free tile in front of it and may move only once they have appeared, and it closes, in 1.9 s. Going home by choice or because the host closed their world, a portal opens beside the visitor, they walk in and vanish, it closes, and only then does their client switch home. With reduced motion the portal fades in and out with a still pattern and the traveller fades in place. A wheezing, rising and falling whoosh built from the synth's pulse, triangle, and noise voices plays on the effects bus when a portal opens. The server picks both tiles and announces portals only on real visits (join/leave carry an optional portal; depart replaces sentHome; clients may send goHome), and every client plays the portal from those messages on its render clock, so the server keeps one departure path and no timers. Verified with typecheck, lint, format:check, 1006 unit tests, 35 e2e tests (new: portals seen by host and visitor on arrival and departure, movement blocked until appearing, none on a reload), screenshots of the built app from two browsers in normal and reduced motion, an offline-rendered WAV, and an output-level check with sound on and muted.
<!-- SECTION:FINAL_SUMMARY:END -->
