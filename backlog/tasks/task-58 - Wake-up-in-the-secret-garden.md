---
id: TASK-58
title: Wake up in the secret garden
status: To Do
assignee: []
created_date: '2026-09-26 13:16'
labels: []
dependencies: []
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every play session starts with the player waking up in the secret garden, as in a bedtime story. Before anything plays, the screen shows: "You wake up in a secret garden. You feel the grass between your toes. Press [space] to start." Pressing Space starts the session and the music (it also serves as the browser's audio unlock gesture). A session ends when the player has had no connection for about 10 minutes, for example after closing the window; they stay logged in, but when they come back the game shows that they fell asleep, then they wake up in the garden again. Reconnecting within the timeout, such as a page reload, keeps the session and the player's position. This replaces decision-6 (returning players resume at their last position) and sets up follow-up changes the user is still working out. The garden also changes: its south path goes away and becomes grass, so the garden opens only to the north, east and west.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The garden screen has no south path: that edge is grass, and roads leave the garden only by its remaining exits
- [ ] #2 Starting a session shows the wake-up message over the garden, exactly: "You wake up in a secret garden. You feel the grass between your toes. Press [space] to start."; nothing moves and no music plays until the player presses Space, which starts the session and the music
- [ ] #3 A new session always places the player in the garden, whatever their last saved position
- [ ] #4 A session ends after about 10 minutes with no connection from the player (the value lives in one setting); the player stays logged in
- [ ] #5 Coming back after a session ended first shows that the player fell asleep, then the wake-up message in the garden
- [ ] #6 Reconnecting before the timeout, for example reloading the page, resumes the same session at the player's position without the wake-up message
- [ ] #7 Existing worlds keep working: the stored garden takes the new layout, and a stored screen south of the garden whose road led to the old south exit stays walkable
- [ ] #8 A decision record replaces decision-6, and e2e tests cover the wake-up start, the reload-resume, and the fall-asleep return using an injected short timeout
<!-- AC:END -->
