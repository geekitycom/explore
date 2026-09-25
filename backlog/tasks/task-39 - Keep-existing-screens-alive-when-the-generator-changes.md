---
id: TASK-39
title: Keep existing screens alive when the generator changes
status: To Do
assignee: []
created_date: '2026-09-25 13:26'
labels: []
milestone: m-3
dependencies: []
documentation:
  - backlog/docs/doc-2 - Decision-log.md
priority: high
type: feature
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Required before running a live world (decision D22). Stored screens are places people have visited or are standing in, so updates must keep them. Today the server refuses to start when stored screens come from an older generator, and generator changes assume a wiped world. Replace that with in-place upgrades and stitching, so the server always starts on an existing world and a reset stays an optional admin choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every change to the stored screen format ships a migration that upgrades existing records in place; no migration deletes screens or player positions
- [ ] #2 The server starts and serves a world containing screens from any earlier generator version, with players resuming where they stood
- [ ] #3 A new screen generated next to a stored screen from an older generator matches the stored screen's shared edge exactly and blends into it, and stays reachable
- [ ] #4 Tests cover upgrading records from every past version, starting on a mixed old and new world, and seam matching at the old/new frontier
- [ ] #5 The startup refusal for outdated screens is removed; pnpm world:wipe --yes remains available as an optional reset
<!-- AC:END -->
