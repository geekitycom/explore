---
id: TASK-33
title: 'Spike: can code recipes match hand-made pixel art?'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-25 01:37'
updated_date: '2026-09-25 01:48'
labels: []
milestone: m-4
dependencies: []
documentation:
  - backlog/docs/doc-4 - Visual-language-and-asset-generation.md
priority: high
type: spike
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Before committing to generated scenery, find out by building it. Throwaway recipes for three tree species (a round broadleaf, a conifer, and a desert plant), a bush, and a rock, rendered at several seeds next to the Ninja Adventure versions in the art gallery, for Andrew to judge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The gallery shows each recipe at several seeds beside the pack sprite it would replace, at game scale
- [x] #2 Recipes use only palette ramps and follow the outline and light rules in the doc
- [ ] #3 Andrew's verdict (go, adjust, or fall back to hand-drawn) is recorded in the decision log
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spike built in scratchpad/recipe-spike (throwaway), viewer at http://localhost:8766/, screenshots in recipe-spike/shots (final.png, final_recipes.png, final_scenes.png; rounds r1-r5).
Five tuning rounds. Result: banded broadleaf, conifer, saguaro, and rocks pass beside the pack; bushes are the weakest (smooth domes versus the pack's notched, lumpy bushes). 0 off-ramp pixels and at most 8 colours per sprite across 50 seeds per recipe. Added colours: #23403C, #4A7F4B, #7B473C (already used by the pack outside Palette.png), #2A4B3F, #3F6E4C, #7FA24A, #D5D66B.
Researcher recommendation: adjust. Recipes for large objects in the pack's drawing method; hybrid (hand-drawn base, recipe recolour and variation) or hand-drawn for bushes and flowers. doc-4 updated: full dark outline to match the pack, and the spike findings.
Waiting on Andrew's verdict (AC 3).
<!-- SECTION:NOTES:END -->
