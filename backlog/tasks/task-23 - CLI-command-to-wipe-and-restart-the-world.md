---
id: TASK-23
title: CLI command to wipe and restart the world
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:27'
updated_date: '2026-09-25 01:42'
labels: []
milestone: m-3
dependencies: []
priority: high
type: chore
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Nothing is deployed yet, so the world can be thrown away when generation changes. Add a command that deletes every generated screen and every player's saved position, keeps accounts, and reseeds the secret garden, so the next login starts fresh in the garden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A documented pnpm command wipes screens and player positions while keeping users and sessions
- [x] #2 It refuses to run without an explicit confirmation flag and prints what it removed
- [x] #3 After a wipe, the next login spawns in the garden and new screens are generated fresh
- [x] #4 It is idempotent: running it twice leaves the same state
- [x] #5 Covered by a test against a real SQLite file
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
wipe.ts: wipeWorld(db) deletes player_state and screens and re-inserts the garden in one transaction, returning counts. wipe-world.ts: CLI requiring --yes, reading DB_PATH like the server. pnpm world:wipe at the root and in apps/server. Test against a real SQLite file.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified: unit test on a real file (accounts and sessions survive, screens and positions gone, garden restored, second run identical). Live: a copy of the M1 verification DB (2 users, 3 sessions, 2 screens, 2 positions) became 2 users, 3 sessions, only the garden, no positions; logging in as oak (last at 0,1) then spawned in the garden at (160,202). Without --yes the command refuses and exits 1. The server keeps screens in memory, so the command says to stop the server first. When world-seeded generation lands (task-26), wiping should also roll a new world seed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added pnpm world:wipe --yes, which deletes generated screens and saved positions, keeps accounts, and restores the garden, idempotently. Verified with a real-file test and a live run on a populated database followed by a login.
<!-- SECTION:FINAL_SUMMARY:END -->
