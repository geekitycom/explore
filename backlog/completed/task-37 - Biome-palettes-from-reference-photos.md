---
id: TASK-37
title: Biome palettes from reference photos
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:37'
updated_date: '2026-09-25 13:57'
labels: []
milestone: m-4
dependencies:
  - TASK-34
documentation:
  - backlog/docs/doc-4 - Visual-language-and-asset-generation.md
priority: low
type: chore
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A tool that extracts dominant colours from public-domain or CC0 reference photos of each biome and snaps them to the master palette ramps, so each biome feels like a real place. Photo sources and licences are recorded.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Running the tool on a biome's reference photos proposes ramps snapped to the master palette
- [x] #2 Every reference photo is public domain or CC0 with its source recorded
- [x] #3 Each biome's chosen ramps are recorded in the style guide
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pick 2-3 PD/CC0 Wikimedia Commons photos per biome; record page, author, licence, thumbnail URL and sky crop in packages/core/scripts/biome-photos/sources.json; commit 250px thumbnails.
2. Tool (pnpm palettes): decode JPEGs, weighted k-means in OKLab, tone-map and chroma-boost, snap to nearest ramp colour, greedy ramp cover. Write packages/core/src/biome-photo-palettes.ts.
3. Show the result in the gallery style section.
4. Choose ramps per biome from the evidence; update BIOME_RAMPS and the style guide.
5. Tests: colour maths, k-means, snapping, greedy cover, licence guard, committed data in sync with a fresh run.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photos are darker and greyer than pixel art; plain nearest-colour snapping made every biome granite/stone. Fix: map photo lightness into the ramps' range and scale chroma by 1.8 before snapping.
Shared colours: greedy cover counts a shared colour once; ties go to the shorter ramp.
Decisions: desert ground adds soil (gravel floors); tundra ground adds straw (summer tussocks). Other biomes keep their sets; reasons per biome in doc-5 Photo palettes.
Observation: forest canopy darks snap to cactus colours, a hint that pine could use a deeper blue-green step. Recorded in doc-5, not acted on.
Validation: pnpm lint, typecheck, test (215 pass), format:check all pass; gallery /art.html?section=style renders Photo palettes with no page errors (Playwright screenshot).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added pnpm palettes: it extracts 12 dominant colours per biome from 19 committed PD/CC0 Wikimedia Commons thumbnails (sources, authors, licences in packages/core/scripts/biome-photos/sources.json), snaps them to the master palette, and proposes ramps by greedy cover. Output is packages/core/src/biome-photo-palettes.ts (exported from @explore/core) and shows in the art gallery style section. Chosen ramps and per-biome reasons are in the style guide; BIOME_RAMPS gains soil for desert ground and straw for tundra ground. Verified by unit tests (including a test that the committed data matches a fresh run), lint, typecheck, format, and a gallery screenshot.
<!-- SECTION:FINAL_SUMMARY:END -->
