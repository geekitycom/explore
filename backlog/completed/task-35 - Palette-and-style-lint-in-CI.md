---
id: TASK-35
title: Palette and style lint in CI
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 01:37'
updated_date: '2026-09-25 14:21'
labels: []
milestone: m-4
dependencies:
  - TASK-34
documentation:
  - backlog/docs/doc-4 - Visual-language-and-asset-generation.md
priority: medium
type: chore
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make the style guide enforceable: a script checks every shipped PNG and every generated sprite against the master palette and per-sprite rules, and CI fails on violations. Existing pack art is remapped to the palette once.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The lint reports each off-palette colour, over-limit sprite, and semi-transparent non-shadow pixel with file and position
- [x] #2 All shipped art passes after a one-time remap, with before and after reviewed in the gallery
- [x] #3 CI runs the lint and fails on violations
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Decode PNGs in packages/core/scripts/png.ts and run styleViolations per sprite cell (no second checker).
2. SHIPPED_ART manifest: every PNG under apps/web/public with cell size and exempt rules plus reasons; unlisted PNGs fail.
3. pnpm lint:art prints file:x,y rule colour and exits 1; --fix remaps off-palette colours to nearest palette colour (OKLab), injective on avatar-recoloured character sheets; rerun is a no-op.
4. Remap pack art once; update AVATAR_BASES keys; move terrain.ts ring colours to the palette; tests pin both to PALETTE.
5. Wire into CI; screenshot game and gallery before and after.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
From TASK-36: packages/core/src/sprite.ts exports styleViolations(image: PixelImage) covering off-palette, too-many-colours, partial-alpha (except SHADOW), stray-pixel and open-outline. Decode PNGs to {width, height, rgba} and reuse it; recipe sprites already pass it (recipes.test.ts). Pack bushes have no bottom outline, so ground-level open-outline may need a per-sheet decision.

Exemptions (per TASK-36 note): ground tilesets skip open-outline and too-many-colours; character walk sheets skip open-outline (feet on unoutlined ground) and too-many-colours (pack characters use 9-10 colours); plant sheet skips open-outline (stem meets ground). No pack PNG had partial alpha or stray pixels.
Remap moves: Boy #E3F1F5->#F2EAF1, #2E3939->#23403C (AVATAR_BASES updated); SamuraiBlue #9BA7AA->#B3957F (nearest unused; #79B8CE is its shirt role); Plant #FFE166->#FFE18D, #F1AE41->#FFAD5D; Floor #E6A578->#F2AD7D, #AD704B->#A3754E; Water sheet 9 colours. A first attempt kept every sheet injective, which turned dirt twigs pink and water foam peach; injectivity now applies only to character sheets.
Terrain bands: #ad704b->#a3754e, #7a4a30->#7b473c, #5a3a24->#4e484a, plus two more off-palette bands the notes missed: #2f4a2a->#2a4b3f, #4a4a6a->#4a5270.
Verified: pnpm lint:art passes on 9 PNGs; a planted #123456 pixel at Fish 8,8 made it print the position and exit 1; an unlisted PNG also fails. lint, typecheck, test (263), format:check, e2e (11) pass. Before/after game and gallery screenshots compared; remap reads the same.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added pnpm lint:art (packages/core/scripts/lint-art.ts): decodes every PNG under apps/web/public, runs styleViolations per sprite cell, prints file, position, rule, and colour, and exits 1. SHIPPED_ART records each sheet's cell size and reasoned exemptions. --fix remapped the pack art to the palette once; the boy avatar's role keys and five terrain edge-band colours followed, with tests pinning both to PALETTE. CI runs the lint. Verified with a planted off-palette pixel (exit 1), lint/typecheck/test/format/e2e, and before/after game and gallery screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
