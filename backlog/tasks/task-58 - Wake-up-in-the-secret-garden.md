---
id: TASK-58
title: Wake up in the secret garden
status: To Do
assignee: []
created_date: '2026-09-26 13:16'
updated_date: '2026-09-26 13:45'
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
- [ ] #1 Starting a session shows the wake-up message over the garden, exactly: "You wake up in a secret garden. You feel the grass between your toes. Press [space] to start."; nothing moves and no music plays until the player presses Space, which starts the session and the music
- [ ] #2 A new session always places the player in the garden, whatever their last saved position
- [ ] #3 A session ends after about 10 minutes with no connection from the player (the value lives in one setting); the player stays logged in
- [ ] #4 Reconnecting before the timeout, for example reloading the page, resumes the same session at the player's position without the wake-up message
- [ ] #5 A decision record replaces decision-6, and e2e tests cover the wake-up start, the reload-resume, and the fall-asleep return using an injected short timeout
- [ ] #6 Coming back after a session ended shows the same wake-up sequence as any new session; there is no separate fell-asleep message, because the player fell asleep while away
- [ ] #7 The wake-up starts on a black screen, and the world is revealed like opening your eyes: a thin horizontal seam across the middle widens up and down until the whole view shows, in about a second; then the wake-up message appears over the garden
- [ ] #8 A player who stays connected never falls asleep, even when idle with the window open
- [ ] #9 The garden's paths run only out of the east and west sides; the north and south sides keep walkable openings in the hedge that are plain grass, and roads leave the garden only east and west
- [ ] #10 Existing worlds keep working: the stored garden takes the new layout, and stored screens north and south of the garden whose roads led to the old exits stay walkable
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
User direction 2026-09-26: idle with the window open keeps the player awake for now; no fell-asleep wording, the wake-up message covers it; add an eyes-opening reveal. Default chosen: the reveal plays first, then the message appears, and Space starts the session and music.

User direction 2026-09-26: paths only east and west; north and south are grass openings.
<!-- SECTION:NOTES:END -->
