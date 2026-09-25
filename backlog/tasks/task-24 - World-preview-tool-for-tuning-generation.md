---
id: TASK-24
title: World preview tool for tuning generation
status: To Do
assignee: []
created_date: '2026-09-25 01:32'
labels: []
milestone: m-3
dependencies: []
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: high
type: chore
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
World-scale generation has many thresholds to tune (biome climate, blend width, densities, road costs). Build a tool that renders a large area straight from a world seed, without a server or database, so every later generation task can be tuned and reviewed by eye. It is the lever for the rest of the milestone (see the v2 design doc, pitfalls).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Renders at least 32x32 screens from a given seed at one pixel per tile or corner, as a PNG or dev page
- [ ] #2 Can colour by terrain, by biome, and show roads and points of interest as overlays
- [ ] #3 Takes a seed and area as arguments and is documented in the README
- [ ] #4 Output for a seed is identical across runs
<!-- AC:END -->
