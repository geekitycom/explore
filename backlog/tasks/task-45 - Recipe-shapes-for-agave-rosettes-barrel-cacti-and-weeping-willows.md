---
id: TASK-45
title: 'Recipe shapes for agave rosettes, barrel cacti, and weeping willows'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-25 16:50'
updated_date: '2026-09-25 18:48'
labels: []
milestone: m-4
dependencies:
  - TASK-38
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-38's flora catalogue models agave as a sage grass clump, barrel cactus as a one-tile armless column, and white willow as a broad flat canopy, because the recipe families have no rosette, squat-barrel, or weeping shape. Add params or families so these species read as themselves, then update FLORA.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Agave, barrel cactus, and white willow each have a silhouette that reads as the real plant in the gallery
- [x] #2 The recipes style lint and own-ramps tests pass for the new shapes
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Cactus params become a union on shape: 'column' (today's saguaro) or 'barrel' (squat ribbed dome, optional flower crown ramp). Migrate saguaro and sample callers.
2. Tree shape gains 'weeping': dome crown with a curtain of hanging strands, open in the middle to show the trunk.
3. New 'rosette' family for agave: thick pointed leaves fanning from a low base. Rigid, no sway.
4. Update FLORA (agave -> rosette sage, barrel -> barrel with straw crown, white willows -> weeping), gallery via SAMPLE_RECIPES, recipe tests.
5. Render before/after crops with a scratch script; run lint, typecheck, test, format:check, lint:art.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Agave became its own 'rosette' family rather than a grass or cactus param: it is neither, and a rigid fan of thick leaves needs its own drawing. Rosettes do not sway. Barrel cactus: CactusParams is now a union on shape ('column' | 'barrel'), with the barrel's optional crown ramp (straw, a desert flora ramp). Barrel draws 7 colours max so the crown fits the 8-colour limit. White willows use tree shape 'weeping'; trunk sets how far the curtain opens over the trunk. Verified: pnpm lint, typecheck, test (448 pass), format:check, lint:art. New silhouette test pairs each shape with a control that must fail it (column vs barrel, broadleaf vs weeping, grass tuft vs rosette). Before/after crops rendered from FLORA and gallery figure screenshots taken with Playwright against the running art.html.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Agave, barrel cactus and white willow now draw as themselves. New rosette family (agave), a squat ribbed barrel cactus shape with a flower crown, and a weeping tree shape with a hanging curtain open over the trunk. FLORA updated; saguaro callers migrated to shape 'column'. Verified with lint, typecheck, full test suite (style lint, own-ramps, anchor and new silhouette tests over every species and seed), format:check, lint:art, and gallery screenshots.
<!-- SECTION:FINAL_SUMMARY:END -->
