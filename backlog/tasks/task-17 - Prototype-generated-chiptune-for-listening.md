---
id: TASK-17
title: Prototype generated chiptune for listening
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-24 23:28'
updated_date: '2026-09-24 23:28'
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
- [ ] #1 A listening page plays generated tunes for at least three moods, each rerollable by seed
- [ ] #2 The same seed always produces the same tune
- [ ] #3 Generated tunes have recognizable structure (repeating motif, phrases, cadence), shown in a piano-roll view
- [ ] #4 Output does not clip
- [ ] #5 Andrew has listened and the decision (generated, pack, or hybrid) is recorded in the decision log
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Throwaway page in the scratchpad (not the repo): vanilla JS + Web Audio. Seeded composer (mood -> scale, tempo, progression, motif, form AABA), NES-style voices (pulse via PeriodicWave with duty, triangle bass, noise drums), switcher for moods and seeds, piano roll, three pack tracks for comparison. Check determinism, structure, and peak level by rendering offline in headless Chrome, then hand to Andrew to listen.
<!-- SECTION:PLAN:END -->
