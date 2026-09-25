---
id: TASK-4
title: 'Art pipeline: CC0 assets, atlas, and terrain transitions'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 21:29'
updated_date: '2026-09-24 22:06'
labels: []
milestone: m-0
dependencies:
  - TASK-1
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Import CC0 terrain, feature, and character art with its license, define the sprite atlas, and produce the corner-mask transitions so terrain blends coherently. See decision-1, decision-4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 All shipped art is CC0 with license files and sources recorded in the repo
- [x] #2 Every corner combination of every terrain pair renders a coherent transition
- [x] #3 Avatar layers can be recolored per the avatar palette and animate in 4 directions
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Delegated to a subagent in an isolated worktree after a research subagent chose Ninja Adventure (D15). Registry tables for sheets, terrain art, feature variants, and avatar color roles; pure mask geometry and terrain composition; per-screen edge bands for shores; palette-swap recoloring per D16; dev-only art gallery (art.html) verified with headless Chrome screenshots.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Delegated to a subagent in an isolated worktree; brief follows D15-D17. Asset research (Ninja Adventure, CC0) done beforehand by a research subagent; report summarized in decision log D15.

Assets: 7 PNGs from Ninja Adventure (TilesetFloor, TilesetWater, TilesetNature, Walk sheets for Boy, Princess, SamuraiBlue, Villager3) plus LICENSE.txt (CC0 1.0) and SOURCES.md; a test fails if any shipped file is unlisted.
Hair styles are now spiky (Boy), long (Princess), bun (SamuraiBlue), bowl (Villager3); palettes unchanged.
Mask shapes are formula-based with a mirrored wobble so every edge crosses a tile side at its midpoint and neighbors always match; shore bands (bank, foam, shallows) are computed per screen so nothing breaks at tile borders.
Mutation checks: breaking edge mirroring fails 2 border tests; dropping the head/body split fails 3 recolor tests; an unlisted PNG fails the sources test.
Known weaknesses: stair-stepped large coastlines from the 16px corner grid; rounded-rectangle edges rather than tufted grass; diagonal-corner pinches; cherry trees are 1 in 6 variants; small shirt/pants areas; a few original neutral pixels on Princess and SamuraiBlue.
Reviewed final screenshots myself (world with grown neighbors, 24-avatar grid): seams invisible, shorelines continuous, recolors clean.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Shipped the CC0 art pipeline: Ninja Adventure assets with license and sources, runtime corner-mask terrain transitions with shorelines, y-sortable feature sprites, and palette-swapped 4-direction avatar walk sheets for four hair styles, plus a dev art gallery. Verified with 24 unit tests (mask border agreement, layer selection, recolor roles, asset licensing), mutation checks, and reviewed headless Chrome screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
