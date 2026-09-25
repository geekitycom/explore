---
id: TASK-29
title: Roads between points of interest
status: To Do
assignee: []
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 01:33'
labels: []
milestone: m-3
dependencies:
  - TASK-27
  - TASK-28
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: medium
type: feature
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Scatter points of interest (clearings, ruins, lakesides, groves, stone circles) with the garden as the hub, connect them with a local neighbourhood graph, and route roads with A* over terrain cost, so players can follow paths across many screens (v2 design doc). Leaves room for towns and cave entrances as future points of interest.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Roads leave the garden's four exits and connect to other points of interest
- [ ] #2 A road is continuous across screen and chunk borders regardless of generation order
- [ ] #3 Roads avoid water where reasonable and ford it otherwise
- [ ] #4 Every point of interest is reachable from the garden by road
- [ ] #5 Roads are visible in the preview tool and in /map
- [ ] #6 Points of interest reserve fixed footprints (flattened, unblocked, reachable) for future towns, houses, and cave entrances, visible in the preview tool
<!-- AC:END -->
