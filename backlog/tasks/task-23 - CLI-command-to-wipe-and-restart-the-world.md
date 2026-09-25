---
id: TASK-23
title: CLI command to wipe and restart the world
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-25 01:27'
updated_date: '2026-09-25 01:39'
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
- [ ] #1 A documented pnpm command wipes screens and player positions while keeping users and sessions
- [ ] #2 It refuses to run without an explicit confirmation flag and prints what it removed
- [ ] #3 After a wipe, the next login spawns in the garden and new screens are generated fresh
- [ ] #4 It is idempotent: running it twice leaves the same state
- [ ] #5 Covered by a test against a real SQLite file
<!-- AC:END -->
