---
id: TASK-52
title: Epitaphs on graves
status: To Do
assignee: []
created_date: '2026-09-25 22:40'
labels: []
milestone: m-5
dependencies:
  - TASK-50.1
  - TASK-50.2
  - TASK-51
priority: medium
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Each grave gets a short epitaph (for example "Here lies Dingus") written once and saved with it, so every player reads the same words forever. Walking up to a grave shows the epitaph in a bubble, the same way signs show their notes, and players can still leave flowers there. Epitaphs come from the language-model text generation when a provider is configured, with a prompt that uses the grave's biome and kind of burial ground, a strict length limit and a filter on the output. Screen generation stays pure and fast, so the epitaph is written after the grave is generated and stored apart from the screen record; until one exists, or when no provider is configured, the grave uses a deterministic fallback epitaph from the world seed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every grave shows an epitaph when a player walks up to it, in the same bubble style as signs
- [ ] #2 An epitaph is generated at most once per grave, stored with it, and identical for every player and after restarts
- [ ] #3 Generation happens outside screen generation, which stays within its time budget and byte-identical
- [ ] #4 Without a provider, or when generation fails, graves show a deterministic fallback epitaph from the world seed
- [ ] #5 Generated epitaphs are length-limited and filtered, and an admin command can replace or clear one
<!-- AC:END -->
