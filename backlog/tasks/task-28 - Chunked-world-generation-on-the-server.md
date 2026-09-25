---
id: TASK-28
title: Chunked world generation on the server
status: To Do
assignee: []
created_date: '2026-09-25 01:32'
labels: []
milestone: m-3
dependencies:
  - TASK-26
  - TASK-23
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: high
type: feature
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Generate and store the world in 4x4-screen chunks when players approach, instead of one screen at a time, and prefetch nearby chunks so crossings are instant (v2 design doc). Connectivity repair runs per chunk.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Travelling into an ungenerated area generates and stores its whole chunk in one transaction
- [ ] #2 Chunks near a player are generated ahead of time without blocking movement
- [ ] #3 Concurrent or repeated requests for the same chunk produce one stored chunk
- [ ] #4 Every walkable region in a chunk is reachable from a road or the chunk's edge
- [ ] #5 Chunks record the generator version
<!-- AC:END -->
