---
id: TASK-39
title: Keep existing screens alive when the generator changes
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 13:26'
updated_date: '2026-09-25 15:26'
labels: []
milestone: m-3
dependencies: []
documentation:
  - backlog/docs/doc-2 - Decision-log.md
priority: high
type: feature
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Required before running a live world (decision D22). Stored screens are places people have visited or are standing in, so updates must keep them. Today the server refuses to start when stored screens come from an older generator, and generator changes assume a wiped world. Replace that with in-place upgrades and stitching, so the server always starts on an existing world and a reset stays an optional admin choice.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every change to the stored screen format ships a migration that upgrades existing records in place; no migration deletes screens or player positions
- [x] #2 The server starts and serves a world containing screens from any earlier generator version, with players resuming where they stood
- [x] #3 A new screen generated next to a stored screen from an older generator matches the stored screen's shared edge exactly and blends into it, and stays reachable
- [x] #4 Tests cover upgrading records from every past version, starting on a mixed old and new world, and seam matching at the old/new frontier
- [x] #5 The startup refusal for outdated screens is removed; pnpm world:wipe --yes remains available as an optional reset
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Core codec: an upgrade chain in packages/core/src/upgrade.ts lifts a stored record one version at a time (v1 gains layer, v2 drops seed, v3 gains the biome the current generator gives that screen); the chain's tuple type is tied to SCREEN_RECORD_VERSION so a bump without a step fails typecheck.
2. Server: openDatabase runs migrations, then rewrites every stored record below the current version in place in one transaction (idempotent, no rows deleted); the startup refusal and outdatedScreens go away.
3. Core generator: generateScreen(world, coord, older) takes a lookup of stored screens made by an older generator. At every lattice point a stored older neighbour holds, the new screen copies it; within STITCH_REACH points of such an edge it dithers between the stored value and the field (water becomes sand in the band, so no new water). Crossings onto an older neighbour are its walkable edge tiles (largest component) whose facing tile is walkable; other seams keep the field rule evaluated on the stitched terrain, which both sides compute identically because a point's stitched value depends only on stored screens within reach (< 15) and both sides see the same ones.
4. Server Chunks passes older(coord) = stored screen with gen_version < GENERATOR_VERSION; travel arrivals use seamOpenings(from, to, dir) computed from the two actual screens instead of field crossings, so arriving in an old screen never throws.
5. Tests: record upgrade from every past version; stitched seams and reachability in a mixed world over six seeds; a real v3 fixture dumped from the dev database (apps/server/fixtures/world-v3.sql) opened, upgraded, played, and extended with a stitched chunk.
6. Decision D23 in the decision log with the rule for future generator changes; lint, typecheck, test, format:check, e2e; boot the server on a copy of the dev v3 database.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Design: record upgrades are a chain in core upgrade.ts (v1 gains layer, v2 drops seed, v3 gains the biome the current generator gives the position; a stamp keeps its own biome). The chain's tuple type is tied to SCREEN_RECORD_VERSION, so a version bump without a step fails typecheck (checked by removing a step: tsc reports the tuple length mismatch). openDatabase rewrites older records in place on every open, in one transaction; nothing is deleted. The old startup refusal and outdatedScreens are gone.
Stitching: generateScreen(world, coord, older) reads stored neighbours with gen_version below GENERATOR_VERSION. A lattice point an older neighbour holds is copied; within STITCH_REACH (6) points the fields dither toward the held value with sand standing in for water, so the band adds no water and land stays connected. Crossings onto an older neighbour are the walkable edge tiles of its largest walkable component whose facing tile is terrain-walkable, the same rule stamps use, so repair joins the new screen to all of the old edge. Same-generation neighbours are not stitched (stitching to them is not a no-op: a neighbour's edge value differs from our point's field value, so the server filters by gen_version). Two new screens sharing a seam agree because a point's stitched value depends only on older screens within 6 points, which are fewer than a screen away and so in both screens' rings, sorted by coordinate for a common tie-break.
Arrivals: play.ts travel uses seamOpenings(from, to, dir) from the two stored screens instead of field crossings, so entering an old screen never throws; a seam with no opening answers with a correct.
Mutation checks on the stitching tests: no copy of held points fails the seam test in all six seeds; no ports onto older screens fails the opening test in all six seeds; water allowed in the band fails the dither test in two seeds. seamOpenings test caught a real sign error in the facing-tile formula while writing it.

Validation: pnpm lint, typecheck, format:check clean; pnpm test 355/355 (32 files); pnpm e2e 11/11. The one vitest 'Unhandled Errors' line comes from play.test.ts teardown (savePlayerState on socket close after db.close), which is on main before this change and is being fixed separately. Real-surface check: the server booted on a copy of the dev database (user_version 4, 40 v3 screens): it started, answered /api/map with 401 and signup with 201, and afterwards the database held 40 v4 records with gen_version 0, corners and features byte-identical to the copy for all 40, the saved position kept, and user_version 6.

Independent review (second model) found: an older screen within reach could out-vote a stamp's lattice point, so siteTerrain now returns stored values first, stamp values second, and dithers only elsewhere (with garden-consistent stored screens the nearest older point to a garden point is itself a garden point, so the real garden cannot show the difference; the clause guards a future stamp). The wipe CLI now opens the database without lifting records, so an unliftable record never blocks the reset (legacy.test.ts covers it, and that a failed lift rolls back every row). travel computes the arrival pose before leaving the old room. The legacy reachability test now starts from the player's saved tile, and every old/new seam in the stitched chunk must have an opening. Not changed: 8 lookups per generated screen and the json_extract scan per open (measured 4.7 ms to open and lift the 40-screen dev world, 46 ms to build a stitched chunk), and the record's own coordinates are trusted as everywhere else. Fresh-world output is byte-identical to the previous generator (256 screens over 4 seeds compared), so GENERATOR_VERSION stays 1.

Final validation on the recut commits: lint, typecheck, format:check clean; pnpm e2e 11/11; pnpm test 353/356 with three timeouts in unrelated files (biome.test, preview.test, web mask.test) under a load average of 14 from parallel agents; the same three files pass alone (19/19) and an earlier full run passed 355/355. CI on main already shows the same timeouts and the play.test.ts teardown logs, which another agent is fixing.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The server now starts on any stored world. openDatabase lifts stored screen records of every past version to the current one in place (core upgrade chain whose tuple type is tied to SCREEN_RECORD_VERSION, so a bump without a step fails typecheck); the startup refusal is gone and pnpm world:wipe --yes stays an optional reset that never depends on the lift. New screens stitch to stored neighbours from an older generator: shared lattice points are copied, a six-point band dithers toward the old edge without adding water, and the crossing onto the old screen is the walkable edge of its main land, so repair connects them. Travel arrivals read the openings of the two actual screens. Decision D23 records the rule for TASK-29/30/32: bump GENERATOR_VERSION for output changes, bump SCREEN_RECORD_VERSION plus one upgrade step for format changes, never delete. Verified with record upgrades from v1, v2, v3; stitched mixed worlds over six seeds (seam equality, blend band, reachability from the garden, pocket repair, mutation-checked); a real v3 dev database fixture opened, lifted, extended with a stitched chunk, walked from the saved tile, and played over a socket; the real server booted on a copy of the dev database with all 40 screens' cells unchanged; lint, typecheck, format, unit tests, e2e.
<!-- SECTION:FINAL_SUMMARY:END -->
