---
id: TASK-58
title: Wake up in the secret garden
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 13:16'
updated_date: '2026-09-26 14:09'
labels: []
dependencies: []
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every play session starts with the player waking up in the secret garden, as in a bedtime story. Before anything plays, the screen shows: "You wake up in a secret garden. You feel the grass between your toes. Press [space] to start." Pressing Space starts the session and the music (it also serves as the browser's audio unlock gesture). A session ends when the player has had no connection for about 10 minutes, for example after closing the window; they stay logged in, but when they come back the game shows that they fell asleep, then they wake up in the garden again. Reconnecting within the timeout, such as a page reload, keeps the session and the player's position. This replaces decision-6 (returning players resume at their last position) and sets up follow-up changes the user is still working out. The garden also changes: its paths run only out of the east and west sides. The north and south sides keep their openings in the hedge, so players can still leave that way, but those openings are grass with no path.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Starting a session shows the wake-up message over the garden, exactly: "You wake up in a secret garden. You feel the grass between your toes. Press [space] to start."; nothing moves and no music plays until the player presses Space, which starts the session and the music
- [x] #2 A new session always places the player in the garden, whatever their last saved position
- [x] #3 A session ends after about 10 minutes with no connection from the player (the value lives in one setting); the player stays logged in
- [x] #4 Reconnecting before the timeout, for example reloading the page, resumes the same session at the player's position without the wake-up message
- [x] #5 A decision record replaces decision-6, and e2e tests cover the wake-up start, the reload-resume, and the fall-asleep return using an injected short timeout
- [x] #6 Coming back after a session ended shows the same wake-up sequence as any new session; there is no separate fell-asleep message, because the player fell asleep while away
- [x] #7 The wake-up starts on a black screen, and the world is revealed like opening your eyes: a thin horizontal seam across the middle widens up and down until the whole view shows, in about a second; then the wake-up message appears over the garden
- [x] #8 A player who stays connected never falls asleep, even when idle with the window open
- [x] #9 The garden's paths run only out of the east and west sides; the north and south sides keep walkable openings in the hedge that are plain grass, and roads leave the garden only east and west
- [x] #10 Existing worlds keep working: the stored garden takes the new layout, and stored screens north and south of the garden whose roads led to the old exits stay walkable
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Garden: north/south corner columns become grass (hedge gaps stay); ports derive from edge dirt, so roads leave east/west only. Bump GENERATOR_VERSION to 9.
2. Stored garden: ensureGarden upserts the stamp (data + gen_version) on every start; stored neighbours keep their edges and stay walkable (seamOpenings needs only both facing tiles open). Legacy-fixture test.
3. Session model: no session table. player_state.updated_at = last known connected (seenAt), written on disconnect, travel, stop, and every flush for all online players. Connect resumes when now - seenAt < SESSION_TIMEOUT_MS (10 min, env override), else garden spawn with screen.wake = true.
4. Web: GameState phase 'waking' (sticky until Space); frame loop and hands idle, ambient motion frozen, no music. ui/wake.ts overlay: black lids open from a middle seam in ~1 s (fade under reduced motion), then the exact message; Space (capture listener) unlocks audio and calls game.wake(), which starts music.
5. Decision D24 (decision-24) replaces D6; docs updated. E2e with SESSION_TIMEOUT_MS=4000: wake start, reload resume, return after timeout, reduced motion. Screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User direction 2026-09-26: idle with the window open keeps the player awake for now; no fell-asleep wording, the wake-up message covers it; add an eyes-opening reveal. Default chosen: the reveal plays first, then the message appears, and Space starts the session and music.

User direction 2026-09-26: paths only east and west; north and south are grass openings.

Default chosen: a reconnect during the wake-up screen (before Space) keeps the wake-up up; a wake flag arriving mid-play (connection lost longer than the timeout) shows the wake-up again and stops the music. Default chosen: the wake-up holds ambient animation still too, since the AC says nothing moves before Space. E2e server uses SESSION_TIMEOUT_MS=4000 (e2e/session.ts); the playing() helper presses Space when a session starts with the wake-up.

Validation: pnpm lint, typecheck, format:check, test (897 unit tests) and pnpm e2e (25 specs, incl. e2e/wake.spec.ts) pass after rebase on 14aecd9. Unit tests: play.test.ts sessions (wake after timeout wherever they were, resume within timeout, idle-connected player survives a crash via flush), legacy.test.ts (stored v3 garden takes the new layout idempotently; its old north/south road ends stay reachable from the spawn), roads.test.ts (garden ports east/west only), generate.test.ts (garden edges), state.test.ts (waking is sticky).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every session now starts with the player waking up in the secret garden. No connection for SESSION_TIMEOUT_MS (10 min; env override) ends the session, judged from player_state.updated_at, which disconnects, travel, shutdown and a 5 s flush of everyone online keep current, so it survives restarts and an open idle window never sleeps. A new session places the player at the garden spawn and sends wake: true; the client holds the world still behind black lids that open from a middle seam in about a second (a fade under reduced motion), then shows the exact wake-up message; Space unlocks audio, starts play and the music. Reloads within the timeout resume in place. The garden's north/south paths became grass (hedge gaps kept), so roads leave east/west only (GENERATOR_VERSION 9); ensureGarden rewrites the stored garden in place and old neighbour road ends stay walkable. Decision-24 replaces decision-6 (rationale in doc-2 D24). Verified with unit tests, the full e2e suite and screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
