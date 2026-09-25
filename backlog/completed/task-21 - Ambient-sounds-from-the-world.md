---
id: TASK-21
title: Ambient sounds from the world
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 23:28'
updated_date: '2026-09-25 13:59'
labels: []
milestone: m-2
dependencies:
  - TASK-18
priority: low
type: feature
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Layer the Ninja Adventure CC0 ambient sounds (wind, river, waves) under the music according to what is on screen: water nearby brings waves or river, open meadows bring wind. Only CC0 audio, listed in SOURCES.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Screens with water play a water ambience and meadows play wind, fading as the mix changes between screens
- [x] #2 Ambience respects mute and effects volume
- [x] #3 Every shipped audio file is CC0 and listed in SOURCES.md
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Ship Wind2.wav, River.wav, Wave.wav from Ninja Adventure Audio/Sounds/Ambient unchanged under public/assets/ninja-adventure, listed in SOURCES.md (sources test enforces it).
2. Pure ambientMix(screen) in apps/web/src/audio/ambience.ts: per-layer level 0..1 for wind, river, waves from terrain corner shares via a per-terrain wind table; unknown terrains fall back to a moderate outdoor wind. Tree/bush cover shelters wind. Small water -> river, lake-sized water -> waves. Unit test.
3. createAmbience(engine): looping buffer per layer, lazily fetched after unlock, each through its own gain into the effects bus so mute and effects volume apply; setTargetAtTime fades on every screen change.
4. Wire in main.ts beside music; expose mix on window.exploreAudio for e2e; extend sound e2e.
5. lint, typecheck, test, format:check, e2e.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Shipped Wind2.wav (steadier and louder than Wind.wav, whose level is near silence), River.wav and Wave.wav unchanged from the pack (about 9 MB of WAV, fetched per layer on first need after audio unlock). Mix: any water on screen plays river; water on 25% or more of the corners (the lake threshold screenMood uses) plays waves instead; wind scales with open ground per terrain and drops under tree/bush cover. Terrains missing from the wind table (for example TASK-27's darkgrass and snow) get a moderate 0.5 wind; TASK-27 can add entries to the WIND table in apps/web/src/audio/ambience.ts. Loudness trims measured in Chrome via an analyser tap: ambience sits about 10 dB under music at default settings. Music selection unchanged.

Validation: pnpm lint, typecheck, test (ambientMix unit tests, sources test covers the new files), format:check, and full pnpm e2e pass. New e2e test taps the output and proves ambience is audible with music at 0, silent when muted, and silent at effects 0; it fails if ambience bypasses the effects bus.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ambient loops (wind, river, waves) from the Ninja Adventure CC0 pack now play under the music on the effects bus, mixed per screen from terrain by a pure ambientMix function and faded over about 1.5 s when the mix changes. Verified with unit tests, the SOURCES.md test, and an e2e output-level test for mute and effects volume.
<!-- SECTION:FINAL_SUMMARY:END -->
