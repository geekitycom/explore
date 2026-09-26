---
id: TASK-65
title: 'Bring the README, screenshots, and Backlog docs up to date'
status: To Do
assignee: []
created_date: '2026-09-26 15:51'
labels: []
dependencies:
  - TASK-64
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The README, its screenshots, and the Backlog docs have fallen behind the game. `docs/screenshots/garden-two-players.png` shows an older garden (it now has only the two paths, north and south). `resumed-after-restart.png` shows resuming in place, which D24 replaced with waking in the garden at the start of every session. The README intro still describes one shared world, which TASK-64 changes to a world per player with visitors by invitation (D25).

Wait for TASK-64 so the docs describe per-player worlds and are written once.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The README hero screenshot shows the current secret garden (two paths), ideally the wake-up screen reading "You wake up in a secret garden. You feel the grass between your toes. Press [space] to start."
- [ ] #2 Screenshots that show behaviour the game no longer has (such as resuming after a restart) are replaced or removed, and nothing references a missing image
- [ ] #3 The README describes the game as it plays now: your own world, opening it for visitors with a code, waking in the garden
- [ ] #4 README commands and settings match package.json scripts and the environment variables the server reads (including the database paths)
- [ ] #5 doc-1 (Architecture) matches the code, including the main database, world files, and how a connection picks its world
- [ ] #6 Other Backlog docs (world generation, visual language, style guide) are checked, and stale statements are fixed or marked as history
- [ ] #7 Screenshots are taken from the running app, the same way every time (for example a Playwright script), so they can be retaken after later changes
<!-- AC:END -->
