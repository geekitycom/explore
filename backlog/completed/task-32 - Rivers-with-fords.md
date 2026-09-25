---
id: TASK-32
title: Rivers with fords
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 17:36'
labels: []
milestone: m-3
dependencies:
  - TASK-29
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: low
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Optional: winding rivers from low-frequency warped noise, with roads crossing at sand fords (v2 design doc). Later a bridge can replace fords.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Rivers are continuous across screens and chunks
- [x] #2 Roads crossing a river get a walkable ford
- [x] #3 Rivers never cut off a point of interest from the road network
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Model a river as an open curve per river cell (a meander about a straight chord, widening downstream into a small pond), kept inside its cell and apart from lakes and the garden clearing. Open, non-touching water arcs leave land connected by construction, so the existing per-screen repair and crossings still hold and no river encloses land.
2. Fold rivers into waterDepth so shores, road cost, POI siting, and terrain all see them; roads over water already become sand fords.
3. Add a biome param for river chance; bump GENERATOR_VERSION (D23) and let the existing stitch band end a river at an older screen.
4. Tests: rivers exist and span several screens, seams agree in any order, every road point over river water is a walkable ford, roads never enter lakes, world reachable from the garden with rivers present, river ends at an older screen without water in the band.
5. Check ambientMix on river screens; preview PNG and in-game ford screenshot.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Rivers are open curves, one per 180x144-point cell (a meandering chord that widens from a walkable spring to a small pond), not the noise-contour rivers the v2 doc sketched: contours close into loops and would wall off land no road reaches. Open arcs that never touch each other or a lake enclose nothing, so the per-screen repair and crossings still hold. Chance per cell is a new biome param, riverChance. Roads pay a ford cost of 10 per river cell (lakes stay 30), which yields a handful of fords per 32x32 screens. GENERATOR_VERSION 4 -> 5 (D23); a river reaching an older stored screen fades to sand in the existing stitch band. Water share on river-only screens: p90 0.20, so ambientMix plays the river layer on about 96% of them; the rest are pond mouths, which play waves. Screen generation ~4.5 ms vs ~3.9 ms before. Verified: pnpm lint, typecheck, test (458 pass), format:check, e2e (11 pass); new rivers.test.ts mutation-checked (closed-loop rivers and roads that skip the ford both fail it).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Rivers wind across several screens from a spring to a pond, deterministic from the seed and continuous across screen and chunk seams. Roads cross them only on sand fords (a ford is cheaper than a lake crossing, so roads use them), and an open river never encloses land, so no point of interest or player is cut off. GENERATOR_VERSION is 5; stored screens keep their look and a river meeting one ends in the stitch band. Verified with new rivers.test.ts (continuity vs fields, no enclosed land over 36x36 screens, walkable fords, graceful end at an older screen), an ambience test on a generated ford screen, the full unit and e2e suites, a world preview, and an in-game screenshot of a ford.
<!-- SECTION:FINAL_SUMMARY:END -->
