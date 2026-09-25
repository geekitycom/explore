---
id: TASK-34
title: Style guide and master palette
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:37'
updated_date: '2026-09-25 13:43'
labels: []
milestone: m-4
dependencies: []
documentation:
  - backlog/docs/doc-4 - Visual-language-and-asset-generation.md
  - backlog/docs/doc-5 - Style-guide.md
priority: high
type: docs
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Write the visual language down: the ramped master palette (about 64 colours, seeded from the Ninja Adventure palette and extended for all eight biomes), light direction, outline rules, scale and anchoring, detail density, and per-sprite limits. The guide is the contract every asset, drawn or generated, must meet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A style guide doc covers palette, ramps, light, outline, scale, anchoring, and per-sprite limits, with visual examples in the art gallery
- [x] #2 The master palette ships as data (not only an image) with every ramp named
- [x] #3 Each of the eight biomes has named ramps for its ground and flora
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Build the master palette as data in packages/core/src/palette.ts: OUTLINE, named RAMPS (dark to light), PALETTE, BIOME_RAMPS for the eight biomes. Seed from Ninja Adventure Palette.png plus the task-33 spike additions.
2. Test it: ramp count, unique colours, 4-6 steps, strict luminance order, pack and spike colours kept, biome sets complete.
3. Add a style section to the art gallery: ramps, biome ramp sets, pack sprites on the 16px grid with anchor tiles.
4. Write the style guide as a backlog doc (doc-5).
5. Verify with lint, typecheck, test, format:check, and a gallery screenshot.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Palette: 64 colours, OUTLINE plus 18 ramps. Keeps all 53 Palette.png colours and the 7 spike additions; adds #6B6A2C (dark straw), #7C88B8 and #A4B8DA (snow shadows), #D2C9C9 (pale granite, already used by the pack floor sheet). Ramps share colours where materials meet, so a colour may belong to several ramps.
Ordering uses WCAG relative luminance; the test fails if any ramp step is not strictly lighter than the one before (checked by swapping two snow steps).
Known off-palette colours for TASK-35 to catch: terrain.ts ring colours #7a4a30, #5a3a24, #ad704b and the pack's own off-palette sheet colours (doc-4).
Gallery: /art.html?section=style. Screenshot verified locally.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the master palette as data (packages/core/src/palette.ts): 64 colours as an outline plus 18 named ramps ordered dark to light, and ground and flora ramp sets for all eight biomes. Wrote the style guide (doc-5) covering palette, ramps, light, outline, scale, anchoring, detail density, and per-sprite limits. The art gallery's new style section shows every ramp, each biome's set, and pack sprites anchored on the 16px grid. Verified with palette.test.ts (count, uniqueness, luminance order, pack and spike colours kept, biome coverage), the full lint, typecheck, test, and format checks, and a gallery screenshot.
<!-- SECTION:FINAL_SUMMARY:END -->
