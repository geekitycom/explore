---
id: TASK-64.1
title: Split storage into a main database and a world file
status: To Do
assignee: []
created_date: '2026-09-26 15:45'
labels: []
dependencies: []
parent_task_id: TASK-64
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move deployment-wide data (users, sessions) into a main SQLite database and everything that belongs to the world (seed, screens, visits, traces, trace reports, player positions, inventories) into a separate world SQLite file. The game still runs one shared world after this task, so behaviour does not change; this is the storage seam the per-player worlds task builds on. See decision-25.

This is a one-time reset (D25): both schemas start fresh instead of carrying the old migration history, and the existing dev database is not migrated.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The server opens a main database and one world file, each with its own migration list, and each migrates on open
- [ ] #2 No foreign key crosses files; world tables store user ids as plain integers, and `users.id` is never reused after a user is deleted
- [ ] #3 Signup, login, avatar, play, map, traces, epitaphs, and landmark names work as before (unit and e2e suites pass)
- [ ] #4 Admin scripts (`world:wipe`, epitaph admin, names) act on the world file
- [ ] #5 Tests and fixtures that exist only to upgrade the old single-file database are removed or rewritten for the new world schema
<!-- AC:END -->
