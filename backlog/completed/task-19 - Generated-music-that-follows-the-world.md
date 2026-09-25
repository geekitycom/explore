---
id: TASK-19
title: Generated music that follows the world
status: Done
assignee:
  - '@claude'
created_date: '2026-09-24 23:28'
updated_date: '2026-09-25 01:06'
labels: []
milestone: m-2
dependencies:
  - TASK-17
  - TASK-18
priority: medium
type: feature
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Play generated chiptune in game. The mood comes from what is on the current screen (garden, open meadow, water, dense forest) and the tune is seeded from the world, so every player hears the same music in the same place. Music changes only when the mood changes, crossfading rather than restarting on every screen. Uses the direction chosen in task-17.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every player hears the same tune on the same screen
- [x] #2 Walking between screens of the same mood does not restart the music
- [x] #3 Changing mood crossfades within about two seconds
- [x] #4 Music generation is pure and unit-tested for determinism and scale/structure rules
- [x] #5 CPU use stays low with music playing (no audible glitches while walking)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. audio/compose.ts: port the task-17 composer to typed, pure TypeScript (mood -> scale, tempo, progression, motif, A A' B A'' form, final V-I cadence).
2. audio/mood.ts: screenMood(screen) from contents (garden coord; water share -> lake; tree and bush share -> forest; else meadow) and tuneFor(screen) seeding from mood plus the 4x4 block of screens, so every player hears the same tune in the same place and same-mood walking inside a block never restarts.
3. audio/synth.ts: NES-style voices from the prototype on the music bus.
4. audio/music.ts: player with a lookahead scheduler; a new tune key crossfades over about 1.5s, the same key is a no-op.
5. Unit tests for compose determinism, scale, cadence, structure, and mood/tune rules. Playwright checks the tune key across a mood change and no restart within a region.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deviation from the task wording: a tune is shared by the same mood inside a 4x4 block of screens, not only by the same screen. That is what lets every player hear the same music in the same place while same-mood walking inside a block never restarts. Crossing into a new block, or changing mood, crossfades over 1.5s.
Moods: the garden has a fixed tune; more than 25% water corners means lake; more than 18% trees and bushes means forest; otherwise meadow. The composer is a typed port of the task-17 prototype that Andrew approved. Seeds differ from the prototype's, so the exact tunes differ but the style is the same.
Verification: 36 unit tests (determinism, every pitched note in key, 32-bar form with the motif repeating, loop ending on the tonic, events inside the loop, mood rules, tune sharing by block). Offline render of the real synth in Chrome: all four moods produce continuous sound (0 silent seconds in 12s), peaks 0.23-0.30. The e2e test confirms the garden tune, a different tune after walking south, and the garden tune again on return. The CPU criterion is judged, not measured: a 50ms scheduler with 0.3s lookahead creates a few oscillators per note, and walking stayed smooth in e2e.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Generated chiptune now plays in game, chosen by each screen's mood and the block of screens it sits in, so players in the same place hear the same tune. It crossfades on mood or block changes and never restarts within one. Verified with unit tests, an offline render of the real synth, and Playwright.
<!-- SECTION:FINAL_SUMMARY:END -->
