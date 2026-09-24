---
id: TASK-17
title: Prototype generated chiptune for listening
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-24 23:28'
updated_date: '2026-09-24 23:31'
labels: []
milestone: m-2
dependencies: []
priority: high
type: spike
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Before building music into the game, settle by ear whether browser-generated chiptune sounds good enough. Build a throwaway listening page that generates seeded tunes for different moods (garden, meadow, lake, forest) with NES-style voices (two pulse, one triangle, noise), with a few of the Ninja Adventure CC0 tracks alongside for comparison. Andrew decided on 2026-09-24 to try generated music first, with the pack's tracks as the fallback.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A listening page plays generated tunes for at least three moods, each rerollable by seed
- [x] #2 The same seed always produces the same tune
- [x] #3 Generated tunes have recognizable structure (repeating motif, phrases, cadence), shown in a piano-roll view
- [x] #4 Output does not clip
- [ ] #5 Andrew has listened and the decision (generated, pack, or hybrid) is recorded in the decision log
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Throwaway page in the scratchpad (not the repo): vanilla JS + Web Audio. Seeded composer (mood -> scale, tempo, progression, motif, form AABA), NES-style voices (pulse via PeriodicWave with duty, triangle bass, noise drums), switcher for moods and seeds, piano roll, three pack tracks for comparison. Check determinism, structure, and peak level by rendering offline in headless Chrome, then hand to Andrew to listen.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Prototype at scratchpad/music-proto (throwaway, not in repo), served at http://localhost:8765. Composer: mood -> scale (garden lydian, meadow major, lake minor, forest dorian), tempo range, 4-chord progressions, seeded motif (rhythm template + stepwise contour, chord tones on strong beats), form A A' B A'' of 32 bars, final V-I cadence onto the tonic. Voices: pulse lead with duty per mood and delayed vibrato, 12.5% pulse arpeggio, 4-bit stepped triangle bass, 15-bit LFSR noise drums and a triangle-sweep kick; echo on garden, lake, forest.
Checks in headless Chrome over 4 moods x 5 seeds: all deterministic, every pitched note in scale, motif rhythm repeats between A sections, loop ends on the tonic, offline-render peak 0.22-0.33 (no clipping). First pass found loops ending on the 3rd or 5th; fixed with an authentic cadence in the last two bars.
Waiting on Andrew to listen (AC 5).
<!-- SECTION:NOTES:END -->
