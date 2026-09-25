---
id: TASK-35
title: Palette and style lint in CI
status: To Do
assignee: []
created_date: '2026-09-25 01:37'
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
- [ ] #1 The lint reports each off-palette colour, over-limit sprite, and semi-transparent non-shadow pixel with file and position
- [ ] #2 All shipped art passes after a one-time remap, with before and after reviewed in the gallery
- [ ] #3 CI runs the lint and fails on violations
<!-- AC:END -->
