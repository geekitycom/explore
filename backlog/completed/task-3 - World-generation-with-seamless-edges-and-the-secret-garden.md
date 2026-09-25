---
id: TASK-3
title: World generation with seamless edges and the secret garden
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 21:39'
labels: []
milestone: m-0
dependencies:
  - TASK-2
priority: high
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pure generator that builds a screen from a seed and any existing neighbors so seams match, plus the hand-built secret garden at (0,0). Riskiest logic in M1. See doc-1 Generation section and decision-10, decision-11.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Shared lattice points always equal the neighbor's (including diagonals) across many random seeds and neighbor layouts
- [x] #2 Edge features copy the neighbor's facing edge
- [x] #3 All walkable edge tiles of a generated screen are in one connected component
- [x] #4 Same seed and neighbors produce the same screen
- [x] #5 Secret garden has walkable openings on all four sides
- [x] #6 A script renders a multi-screen preview so seams can be inspected visually
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. rng.ts: seeded mulberry32 so generation is deterministic per seed.
2. generate.ts generateScreen(coord, seed, neighbors) where neighbors is the 8-neighborhood:
   a. Fixed lattice points copied from every existing neighbor, including the single shared point of each diagonal.
   b. Fixed edge features copied from each edge neighbor's facing row or column (edge neighbors in n, s, w, e priority at corner tiles).
   c. Height and dirt fields from 2-octave value noise plus a per-screen bias (lake, meadow, forest variety), blended toward targets implied by fixed points with inverse-distance weights that fade about 3 tiles in. Bands: water, sand, land; dirt from the second field. Fixed points written back exactly.
   d. Feature density field (noise + screen forestiness), blended toward neighbor edge features. Trees and bushes on grass, rocks on land, flowers and tall grass as decoration.
   e. Mirror rule: an edge tile facing a walkable neighbor tile is carved walkable.
   f. Every edge with no neighbor gets at least one opening.
   g. Connectivity repair: Dijkstra from each extra edge-touching component to the main one over carve costs (clear feature 4, raise water corners to sand 8). Tiles whose blocking is fixed are impassable.
3. garden.ts: hand-built ASCII secret garden, decoded through the codec.
4. Property tests: grow random worlds from the garden by random adjacent discovery; assert seam lattice equality (edges and diagonals), non-corner edge feature continuity, walkable-implies-walkable across seams, edge connectivity, determinism, garden openings.
5. scripts/preview.ts renders a grown world to PNG (node:zlib, no deps) for visual inspection.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Property suite grows 12 worlds of 60 discoveries from the garden (about 720 screens) and checks seam lattice equality over every 8-neighbor pair, edge feature continuity, walkable-implies-walkable across seams, connectivity, and that every screen has a walkable edge tile.
Mutation check: dropping diagonal lattice copies, dropping the mirror-walkability step, and dropping connectivity repair each fail exactly the matching property (4, 11, and 12 failing cases respectively).
Found one legitimate exception: a corner tile walled in by features copied from two different neighbors can't be carved. A player can only enter it from a neighbor it borders, so they can always leave the way they came. The property now allows only pockets walled in entirely by edge tiles.
Tuning: noise cell sizes raised (height 10, dirt 7, density 7) after the first preview showed speckled lakes; tree chance raised so forests read as forests. Preview via pnpm --filter @explore/core preview <seed> <count> <out.png>. Rendered 200-screen worlds for seeds 1-5 without errors; seams invisible in preview.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the constraint-conditioned generator (lattice and edge-feature copying from all 8 neighbors, blended value-noise terrain and features, mirror walkability, free-edge openings, Dijkstra connectivity repair), the hand-built secret garden, a seeded RNG, and a PNG world preview script. Verified with 65 property and unit tests over ~720 generated screens, a mutation check proving the key properties catch regressions, and visual inspection of rendered previews.
<!-- SECTION:FINAL_SUMMARY:END -->
