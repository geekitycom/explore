---
id: TASK-28
title: Chunked world generation on the server
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 14:23'
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
- [x] #1 Travelling into an ungenerated area generates and stores its whole chunk in one transaction
- [x] #2 Chunks near a player are generated ahead of time without blocking movement
- [x] #3 Concurrent or repeated requests for the same chunk produce one stored chunk
- [x] #4 Every walkable region in a chunk is reachable from a road or the chunk's edge
- [x] #5 Chunks record the generator version
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core: chunk geometry (CHUNK_W=CHUNK_H=4 screens, ChunkCoord, chunkOf, chunkScreens) and GENERATOR_VERSION; connectivity repair also joins every walkable pocket to a crossing so every walkable region in a chunk reaches its edge.
2. Server: migration adds screens.gen_version (default 0 for screens stored before this task); no chunks table, because a chunk is a generation and prefetch unit while the stored truth is per screen, which is what TASK-39 needs for in-place upgrades and stitching.
3. Server: a Chunks store ensures a chunk synchronously on travel (all 16 screens in one transaction, insert-or-ignore) and prefetches the chunks of the 8 neighbouring screens in setImmediate slices of one screen each, so movement is never blocked more than one screen's generation (~3 ms). A synchronous ensure completes an in-flight prefetch job instead of generating again.
4. Tests: pocket reachability across seeds; one stored chunk under concurrent travel and prefetch with a generation counter; prefetch keeps the event loop free; crossing latency measured before and after.
5. lint, typecheck, test, format:check, e2e; land on main.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Measured before choosing the shape: 3.1 ms per screen (50 ms per chunk of 16), 1.2 walkable pockets per screen (70% single tiles). Crossing latency at walking pace before: median 14.1 ms, p90 19.0 ms, max 24.2 ms.
Storage shape: no chunks table. screens gains gen_version (default 0 for rows stored before this task); a chunk is a generation and prefetch unit, the stored truth stays per screen, which is what TASK-39 needs for in-place upgrades and stitching, and it stays honest for chunks that already held single screens.
Repair stays per screen plus pockets. The design doc's chunk outer-ring rule was dropped: tiles are never shared across a seam (only lattice corners and crossings are), so nothing reads a neighbour's ring features, and the rule would have had no consumer.
Prefetch runs on the main thread one screen per setImmediate turn (about 3 ms) rather than in a worker thread; a synchronous arrival finishes the in-flight job instead of generating the chunk again.

Review pass (independent reviewer) found two failure-path defects, both fixed: a failed store left a job that poisoned its chunk until restart, and a throw inside the prefetch turn would have killed the process. A failing job is now forgotten and logged, and chunks.test.ts covers it. main.ts calls game.stop() on shutdown.
Validation: pnpm lint, typecheck, format:check, test (243 unit tests, 27 files) and pnpm e2e (11 passed) all green. Crossing latency after, at walking pace: median 1.9 ms, p90 4.6 ms, max 7.3 ms, every crossing served from storage; a player crossing with no pause outruns prefetch at every fourth screen and pays the synchronous chunk build there (35 to 65 ms).
Product side effect, filed as TASK-42: /map lists every stored screen, so prefetched land now shows as discovered (64 screens right after signup).
Stored format: unchanged (screen record v4). New column screens.gen_version. No wipe needed and none performed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The server generates and stores the world in 4x4-screen chunks: an arrival at an unstored screen builds its chunk and stores all 16 screens in one insert-or-ignore transaction, and the chunks around every sent screen are prefetched one screen per event-loop turn. Each chunk has one job, and an arrival mid-prefetch finishes that job, so concurrent or repeated approaches generate a chunk once (chunks.test.ts). Screens record gen_version (GENERATOR_VERSION 1; earlier rows 0). Repair now joins every walkable pocket to a crossing, so every walkable region reaches the screen edge (generate.test.ts, zero stranded regions across six seeds). Verified with lint, typecheck, format:check, 243 unit tests, 11 e2e tests, and a crossing-latency bench: median 14.1 ms before, 1.9 ms after at walking pace.
<!-- SECTION:FINAL_SUMMARY:END -->
