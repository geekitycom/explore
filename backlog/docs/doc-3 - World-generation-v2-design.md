---
id: doc-3
title: World generation v2 design
type: specification
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 01:32'
---
# World generation v2: biomes, roads, and chunks

Status: proposed (2026-09-24). Replaces the neighbour-constrained generator (decision-10) once implemented. Research by a subagent from the sources listed at the end; layer support added from Andrew's note that houses, caves, and towns come later as separate layers.

## Goal

The world should feel designed at a scale larger than one screen. Players walk from one biome into another, follow paths that lead somewhere, and hear one tune across a biome. The world still does not exist until someone approaches it, and once generated it is stored.

## Core idea

Every tile is a pure function of `(worldSeed, layer, gx, gy)`. Global coordinates are `gx = sx * 20 + cx` and `gy = sy * 15 + cy` on the corner lattice. A shared lattice point therefore has the same value on both sides of a seam, whatever order screens are generated in. Seams match by construction, and a biome or road can span any number of screens. A property that makes this work is that "the biome at position (x,y) is independent of calculations at any other location" [1].

Today each screen only sees its eight neighbours, so nothing can be coherent beyond one screen. The neighbour-copy code (`copyNeighborLattice`, `copyNeighborEdgeFeatures`, `blendTowardFixed`, `mirrorEdgeWalkability`, `openFreeEdges`, `neighborsOf`) goes away. Decision-9 (corner lattice) and decision-17 (mask rendering) stay. Decision-11 (connectivity) stays but applies per chunk.

## Layers

Coordinates carry a layer from the start: `{ layer, sx, sy }`, with `overworld` as the only layer for now. Later phases add interiors (houses, caves, towns' buildings) as their own layers. An entrance is a feature on an overworld tile that links to a place in another layer. Towns and cave mouths are points of interest that roads already connect to, so the road network does not need rework when places arrive.

## Data shapes (core, pure)

- `WorldSeed`: a branded number in a one-row `world` table. Wiping the world means a new seed.
- `Fields`: elevation, moisture, temperature, warp, and detail, each fractal noise with its own derived seed, evaluated at global coordinates. Low octaves shape land, high octaves add detail [1].
- `BiomeCell { id, site, biome }`: one jittered site per cell of a grid about 8x8 screens. The biome comes from a temperature and moisture table sampled at the site [1]. A tile belongs to the nearest site to its domain-warped position `p + fbm(p)` [4], so borders are organic.
- `BiomeParams`: water, sand, and dirt thresholds, and densities for trees, bushes, rocks, flowers, tall grass, and clearings. Tiles blend nearby sites' params with distance falloff, and weights jittered by noise so borders dither instead of drawing a line [5]. The blend band is about one screen wide.
- `Poi { id, region, at, kind }`: at most one per 6x6-screen region, placed with a seeded offset per grid cell and a minimum separation, which needs no global state [3]. Kinds now: `hub` (the garden), `clearing`, `ruin`, `lakeside`, `grove`, `stones`. Reserved for later layers: `town`, `cave`, `house`.
- `RoadEdge { a, b, path }`: a pure function of the seed and its two ends, cached.
- Chunk record: `chunks { layer, cx, cy, gen_version, created_at }`, plus screen rows `{ v: 2, layer, sx, sy, biome, corners, features }`. The per-screen seed goes away.
- Terrain gains `darkgrass` (forest floor) and `snow`, for the layer order water, sand, dirt, grass, darkgrass, snow. Each new terrain needs its 16 corner masks, built from the pack's fill tiles (decision-17).

## Biomes, tiles, and music

The table is keyed by temperature (cold, temperate, hot) and moisture (dry, mid, wet) [1]. Keeping climate smooth avoids snow next to desert [9].

| Biome | Climate | Ground and features | Music mood |
| --- | --- | --- | --- |
| Meadow | temperate, mid | grass, flowers, tall grass, scattered trees | meadow |
| Forest | temperate, wet | darkgrass, dense trees, bush undergrowth, clearings | forest |
| Lakeland | temperate or warm, wet, low | big lakes with sand shores, tall grass | lake |
| Scrubland | warm, dry | grass with dirt patches, bushes, rocks | frontier (new) |
| Desert | hot, dry | sand, rocks, rare bushes, oasis ponds | desert (new) |
| Highlands | cool, dry, or high | dirt and grass, rock clusters, lone trees | highland (new) |
| Taiga | cold, wet | snow with darkgrass, dense trees | taiga (new) |
| Tundra | cold, dry | snow, rocks, sparse bushes | snow (new) |
| Garden | stamp only | the hand-built garden | garden |

Music keys on `(biome, cellId)`. The current tune keeps playing while the biome label stays the same, so it only changes when you walk into a different biome patch. This replaces the per-screen mood heuristics and the 4x4 tune regions.

## Roads

1. Nodes are the points of interest. The garden is a degree-4 hub, and its four existing dirt exits are fixed road ends.
2. Edges come from a relative neighbourhood graph over the points in the surrounding 5x5 regions: keep edge ab when no third point is closer to both. The decision needs only nearby points, so any chunk computes the same graph. It contains the minimum spanning tree plus a few loops. (Locality is the researcher's reasoning, not from a source.)
3. Route each edge with A* over a tile cost field [6]: grass and dirt 1, sand 2, forest 4, rock 6, water 30 (becomes a sand ford, later a bridge), plus a little noise so roads meander. Cost-minimising routing over terrain is the idea in Galin et al. [8]. The search is limited to the pair's bounding box plus a margin, with deterministic tie-breaks, so every chunk gets the same path.
4. Roads are rasterised as dirt three corners wide, matching the garden paths, clearing blocking features. A chunk routes every edge whose corridor touches it and keeps its own cells. Routes are pure, so caching is only an optimisation.
5. Optional rivers: water where low-frequency warped noise is near zero. They are local and continuous, though they do not really flow [2][11]. Roads crossing a river become fords.

## Chunks

- A chunk is 4x4 screens. That is big enough for coherent connectivity repair and small enough to generate in tens of milliseconds.
- `ensureChunk(layer, cx, cy)` generates all 16 screens, rasterises roads, places features, and repairs connectivity. It writes everything in one transaction with insert-or-ignore, so it is idempotent under races and restarts.
- On travel, the target chunk is ensured synchronously. Chunks within reach of the player are then prefetched in the background, so the next crossing is already built.
- Connectivity repair joins every walkable region in a chunk to a road. It never edits the chunk's outer tile ring, which both sides compute identically. World-wide reachability then reduces to the road graph being connected. The arrival nudge stays.
- `gen_version` is bumped whenever generator output changes. Old chunks stay as they are, or the world is wiped.

## The garden

The garden becomes a stamp: `STAMPS = [{ layer: overworld, screen: (0,0), data: secretGarden(), ports }]`. Inside its footprint, including the boundary, the field functions return the stamp's cells, so neighbours compute the same seam. A ring about 1.5 screens wide around it pulls terrain to dry grass and thins blocking features, so the garden sits in a meadow clearing. Its biome is `garden`, and the ring is `meadow`. Future hand-built screens and interiors use the same registry.

## Making it feel designed

- Landmarks at points of interest: a stone circle, a ruin of rocks, a lone big tree in a clearing, a lakeside beach. Perceptual uniqueness is what matters [12].
- A band of bushes along forest edges.
- Lakes with sand shores from the elevation band, with size capped so roads do not detour for screens.
- Sub-patches within a biome (a flower field, a birch stand) from the detail field.
- Jittered or Poisson placement rather than high-frequency noise [1][13].

Pitfalls to avoid: creases where blend radius or jitter is too small [5]; roads routed from one side only, which split at seams; any shared random stream, since every decision must hash `(seed, purpose, coords)`; and tuning blind, which is why the preview tool comes first [1].

## Migration

Nothing is deployed, so there is no compatibility layer. The world is wiped (task-23), a new migration adds `world`, `chunks`, and the layer column, and the codec moves to `v: 2`. The neighbour-constraint code and its property tests are deleted in the same change. New tests cover seam equality under any generation order, determinism, garden seams, and reachability of every walkable region from a road.

## Sources

1. https://www.redblobgames.com/maps/terrain-from-noise/
2. https://www.redblobgames.com/maps/mapgen4/
3. https://minecraft.wiki/w/Structure_set and https://minecraft.wiki/w/World_generation
4. https://iquilezles.org/articles/warp/
5. https://noiseposti.ng/posts/2021-03-13-Fast-Biome-Blending-Without-Squareness.html
6. https://www.redblobgames.com/pathfinding/a-star/introduction.html
7. https://tdcoy.github.io/procmapgen (search snippet only)
8. https://perso.liris.cnrs.fr/egalin/Articles/2010-roads.pdf (abstract via search)
9. https://www.minecraftforum.net/forums/minecraft-java-edition/survival-mode/2303104-need-help-in-understanding-biome-generation (search snippet only)
10. https://ozonewipeout.itch.io/ozone-wipeout/devlog/338218/devlog-january-23rd-2022
11. https://www.redblobgames.com/x/1723-procedural-river-growing/
12. https://galaxykate0.tumblr.com/post/139774965871/so-you-want-to-build-a-generator (search snippet only)
13. https://www.redblobgames.com/x/1830-jittered-grid/
