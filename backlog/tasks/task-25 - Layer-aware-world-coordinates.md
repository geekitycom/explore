---
id: TASK-25
title: Layer-aware world coordinates
status: To Do
assignee: []
created_date: '2026-09-25 01:32'
labels: []
milestone: m-3
dependencies: []
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: high
type: feature
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Houses, caves, and towns will be separate layers the player travels into (decision-20). Give screen coordinates a layer now, with overworld the only one, so later phases add layers without migrating every table and message.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Screen coordinates, stored screens, player positions, and protocol messages carry a layer, defaulting to overworld
- [ ] #2 Two screens at the same sx, sy on different layers are distinct everywhere (storage, presence, travel)
- [ ] #3 Players on different layers never see each other
- [ ] #4 Existing tests pass and new tests cover layer separation
<!-- AC:END -->
