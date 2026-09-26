---
id: TASK-64
title: Every player gets their own world
status: To Do
assignee: []
created_date: '2026-09-26 15:45'
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
- [ ] #1 A new account lands in its own freshly seeded world, starting in its own secret garden
- [ ] #2 Two accounts that were not invited never see each other or each other's screens, traces, or landmarks
- [ ] #3 An invited visitor plays in the host's world alongside the host
- [ ] #4 doc-1 (Architecture) describes the main database, world files, and how a connection picks its world
<!-- AC:END -->
