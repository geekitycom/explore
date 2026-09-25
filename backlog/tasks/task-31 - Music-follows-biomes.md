---
id: TASK-31
title: Music follows biomes
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-25 01:32'
updated_date: '2026-09-25 14:10'
labels: []
milestone: m-3
dependencies:
  - TASK-27
documentation:
  - backlog/docs/doc-3 - World-generation-v2-design.md
priority: medium
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Key the music to the biome patch instead of per-screen heuristics, so one tune carries across a biome and changes only when you walk into a different one. Add moods for the new biomes (frontier, desert, highland, taiga, snow). Replaces screenMood and the 4x4 tune regions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Walking within one biome patch never changes the tune
- [x] #2 Entering a different biome crossfades to its tune
- [ ] #3 Every biome has a mood, and the new moods are distinct by ear (checked with Andrew)
- [x] #4 Players in the same biome patch hear the same tune
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. core: export screenBiome(world, coord) (the sample at the screen centre) and use it in generateScreen, so the stored biome and the patch sent to clients come from one call.
2. protocol: the 'screen' message carries patch: BiomeCell next to the record. The server computes it with screenBiome; the stored record and SCREEN_RECORD_VERSION stay as they are, so no wipe and no server storage change.
3. web: the tune is keyed on (biome, patch): Tune = { biome, seed, key }, seed hashed from the patch cell, garden fixed. Delete screenMood and TUNE_REGION.
4. compose: key MOOD_STYLES on Biome (lake becomes lakeland) and add scrubland (frontier), desert, highlands, taiga, tundra styles, with new scales, bass, arp, and drum patterns so each sounds distinct.
5. Tests: tune stays inside a patch and changes across patches using real generated screens; compose tests run for every biome. Render a short WAV per biome for Andrew's by-ear check.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Patch id travels in the 'screen' message (patch: BiomeCell), computed on the server by the new core screenBiome(world, coord), which generateScreen also uses for the stored biome. The stored record and SCREEN_RECORD_VERSION are unchanged, so no world wipe is needed. Tune key is ${biome}:${seed} with the seed hashed from the patch cell; the garden keeps garden:1. Moods are keyed on Biome directly (lake became lakeland); new styles: scrubland (frontier: major, gallop bass and drums, strummed arp), desert (harmonic minor, drone bass, hand drums), highlands (mixolydian, drone, march snare), taiga (phrygian, rolling arp, echo), tundra (slow minor, high twinkle arp, heavy echo, no drums).
Validation: pnpm lint, typecheck, test (269 pass), format:check, e2e (11 pass; sound.spec walks garden to meadow and back and sees the tune change). mood.test.ts checks over a 25x25 screen grid of a real world that each patch has one tune and patches have distinct tunes.
AC3 open: 20-second WAV renders of every biome mood (seed 42) are at /private/tmp/claude-501/-Users-andrewshell-code-geekity-explore/5fcbf254-9b57-47b2-a2bf-c0a00fadf132/scratchpad/render/*.wav for Andrew to listen to. Task stays In Progress until he signs off.
<!-- SECTION:NOTES:END -->
