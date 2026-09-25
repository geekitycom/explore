---
id: TASK-24
title: World preview tool for tuning generation
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 01:45'
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
- [x] #1 Renders at least 32x32 screens from a given seed at one pixel per tile or corner, as a PNG or dev page
- [x] #2 Can colour by terrain, by biome, and show roads and points of interest as overlays
- [x] #3 Takes a seed and area as arguments and is documented in the README
- [x] #4 Output for a seed is identical across runs
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Delegated to a subagent in an isolated worktree; reviewed and cherry-picked. WorldSource interface (corners, features, optional biomes, roads, pois per screen) with a neighbourSource wrapping today's generator, grown in whole rings from the garden so any area is order-independent; renderer with terrain and biome modes, road and POI overlays, grid, scale; small CLI parser.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified: 64x64 screens render in 0.73-0.81 s; default 32x32 in about 0.2 s; two runs of the default render are byte-identical (cmp), and a determinism test fails if screen seeds use Math.random. Biome mode draws greyed terrain with a note until biome data exists. Later generation tasks add a fields-based WorldSource and select it with a flag. Added world-preview.png (the default output name) to .gitignore.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the old preview with a world preview tool: pnpm --filter @explore/core preview renders any area from a seed to PNG with terrain or biome colouring, road and POI overlays, grid, and scale, through a WorldSource interface the v2 generator will plug into. Verified byte-identical output, timings, and tests.
<!-- SECTION:FINAL_SUMMARY:END -->
