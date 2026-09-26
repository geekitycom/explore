---
id: TASK-64
title: Every player gets their own world
status: Done
assignee:
  - '@claude'
created_date: '2026-09-26 15:45'
updated_date: '2026-09-26 17:52'
labels: []
dependencies: []
documentation:
  - backlog/docs/doc-2 - Decision-log.md
  - backlog/docs/doc-1 - Architecture.md
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Single player becomes the default: creating an account creates that player's own world, and playing together happens only by invitation. Storage splits into a main SQLite database for accounts and one SQLite file per world, so a world can later move to another API server. See decision-25 and D25 in doc-2 (Decision log).

The switch is a one-time reset: the local dev world and its accounts are wiped, not migrated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A new account lands in its own freshly seeded world, starting in its own secret garden
- [x] #2 Two accounts that were not invited never see each other or each other's screens, traces, or landmarks
- [x] #3 An invited visitor plays in the host's world alongside the host
- [x] #4 doc-1 (Architecture) describes the main database, world files, and how a connection picks its world
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Delivered through the three subtasks: TASK-64.1 split storage into main.db and worlds/<id>.db, TASK-64.2 gave every account a world and made every connection name its world through one access seam, TASK-64.3 opened worlds to visitors by code with one close path that sends visitors home. doc-1's Server and Protocol sections were rewritten in TASK-64.3 to describe the two databases, the world host, the access rule, visiting, and the protocol as it is.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AC evidence. #1: app.test 'signup creates the account's world file with its own seed and the garden' and e2e wake.spec (a new account wakes at the garden spawn of its own world; each world file rolls its own seed, db.test). #2: play.test 'keeps players in different worlds apart: no presence, moves, traces, or screens cross' and 'lets a player into their own world only, closing a socket into another with a code' (4403 socket, 403 map); worlds.test admission returns undefined for anyone but the owner while the world is closed. #3: TASK-64.3 (play.test visitors describe, host.test, e2e world.spec, avatar.spec, visitors.spec, and the two-browser run of the built app). #4: doc-1 Server section now describes main.db and worlds/<id>.db with their separate migration lists, the world registry, createWorldHost, /ws/worlds/:id with admission() as the access rule, visiting, and the session rule; the Protocol section names the socket path and the current message set. TASK-65 still owns the README, screenshots, and the wider doc sweep (its AC #5 restates this AC and is met by the same edit).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every player gets their own world: accounts live in main.db, each world in its own SQLite file with its own seed and garden, a world host runs one game per open world, every connection names its world and admission() decides entry (the owner, or a visitor with the world's current code), and the owner can open their world for friends with a code and close it again, sending visitors home. Verified across the three subtasks with typecheck, lint, format:check, 991 unit tests, 33 e2e tests, and scripted runs of the real server; doc-1 describes the storage and how a connection picks its world.
<!-- SECTION:FINAL_SUMMARY:END -->
