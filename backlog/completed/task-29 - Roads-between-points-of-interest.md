---
id: TASK-29
title: Roads between points of interest
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 15:58'
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
- [x] #1 Roads leave the garden's four exits and connect to other points of interest
- [x] #2 A road is continuous across screen and chunk borders regardless of generation order
- [x] #3 Roads avoid water where reasonable and ford it otherwise
- [x] #4 Every point of interest is reachable from the garden by road
- [x] #5 Roads are visible in the preview tool and in /map
- [x] #6 Points of interest reserve fixed footprints (flattened, unblocked, reachable) for future towns, houses, and cave entrances, visible in the preview tool
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. core poi.ts: a POI kind registry (footprint reach, ground, biome weights, shore need) with hub, clearing, ruin, lakeside, grove, stones, town, cave; one point per 6x6-screen region, the garden stamp as the degree-4 hub whose four dirt exits are ports.
2. core roads.ts: relative neighbourhood graph over nearby points (local, deterministic), plus an edge for any hub port left without one; each edge routed by A* on a 5-tile cell grid over a cost field (water 30 as a sand ford, shore 2, woods up to 4, meander noise), bounded box, deterministic ties; paths smoothed and cached per world.
3. generate.ts: a per-screen plan (road points within 1.5 of a path, footprint ellipses) overrides terrain after stamps; roads and footprints clear blocking features; roads stay solid through the stitch band so a road ends cleanly at an older stored screen (D23). Drop the garden trails the roads replace. Bump GENERATOR_VERSION to 2.
4. Tests: order independence with fresh networks and chunk-order generation, seam continuity, garden exits, water avoidance, every POI reachable from the garden, footprints flat and unblocked, stitching to older screens.
5. Preview tool shows roads, POIs, footprints; screenshot preview and /map.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shape: core poi.ts holds POI_KINDS (one entry per kind: footprint reach, ground, biome weights, optional shore need) and places one point per 6x6-screen region; the garden stamp is the hub, its four dirt exits are ports. core roads.ts builds the relative neighbourhood graph of points within one region of each other (witnesses searched three regions out), adds a road for any fixed exit left without one (needed in about half of seeds), and routes each road with A* on a 5-point cell grid (water 30, shore 2, woods up to 3, smooth meander noise up to 3; stamps impassable; ties by cell index), then Chaikin-smooths it. network.plan(box) says which lattice points are road (within 1.5 of a path) or footprint ground; generate.ts applies it after stamps and before water, and clears blocking features on tiles touching either.
Defaults chosen: towns and caves are placed now and render as clearings (design doc); houses as secondary points with spurs are left for when houses ship. Footprints flatten to the kind's ground or the biome's plain ground (grass, darkgrass, sand, snow). The garden trails (onTrail) are gone; the road stubs out of each exit replace them. fieldFeature was unused and is deleted.
D23: GENERATOR_VERSION 2. Stored screens are kept; a road is exempt from the stitch dither so it runs solid to an older screen's edge and ends there. No wipe needed.
Fords: current lakes never cut land apart, so real roads never ford (a test asserts no road point lies in a lake). The ford-on-sand path is covered only through a synthetic river network test; TASK-32 rivers will exercise it for real.
Validation: pnpm lint, typecheck, format:check, test (384 passed), e2e (11 passed). Mutation checks: removing the exit rule, cheap water, a complete graph, unpadded segments, uncleared footprints, and dithered roads each fail a test. Screenshots: scratchpad task29-preview.png (preview, 32x24 screens with roads and POIs) and task29-map.png / task29-map-zoom.png (/map over 560 visited screens). Follow-ups: TASK-43 (map zoom stripes, pre-existing), TASK-44 (roads look like dirt patches in dirt-heavy biomes).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Points of interest (one per 6x6-screen region, kinds from a registry, towns and caves included as clearings) are joined by roads that leave all four garden exits, follow the relative neighbourhood graph, and route around lakes and woods with A*. Roads and footprints are pure functions of the world seed, so screens and chunks agree in any order; stored older screens are kept and roads end cleanly at their edge (D23, GENERATOR_VERSION 2). Verified with new core tests (fresh networks in two chunk orders, seam agreement, garden exits over 8 seeds, reachability from the garden, water avoidance, footprints, stitch band), mutation checks, the full test and e2e suites, and screenshots of the preview tool and /map.
<!-- SECTION:FINAL_SUMMARY:END -->
